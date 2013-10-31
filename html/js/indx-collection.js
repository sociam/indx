/* global angular, console, Backbone, _, $ */

/// @title indx-collection
/// @author Peter West <peter@peter-west.co.uk>
/// @version 0.1
///
/// indx-collection makes it easier to deal with arrays stored in indx by
/// using Backbone. It allows arrays to be managed using Collections and objs
/// to be managed using Models, both of which are extensions of Backbone's
/// Collection and Model classes.
///
/// ## Events
/// | Event   | Object | Description  |
/// |---------|--------|--------------|
/// | restore | Model  | model is no longer being editing |
/// | edit    | Model  | model is now being edited |
/// | select  | Model, Collection  | model has been selected |
/// | update  | Collection | model has been restored |
/// | created | Model | when a model has been created and saved |
/// | add     | Collection | model has been added |
/// | addAny | Collection | model is added to allModels (including before it has been saved) |
/// | remove  | Model, Collection | model or model in collection has been removed |
/// | reset   | Collection | collection has been reset |
/// | change  | Model, Collection | model or model in collection has changed |
/// | sort    | Collection | collection has been sorted |

angular
	.module('indx')
	.factory('collection', function (client) {
		'use strict';

		var Obj = client.Obj;

		/// A model is an extension of indx Obj, and adds functionality useful
		/// for maintaining collections of objs.
		///
		/// It also provides states which may be useful in developing views -
		/// a model may be being edited (`isEditing`), selected
		/// (`isSelected`) or has been created (`isCreated`). While being edited
		/// (or new), stagedAttributes may be written to instead of
		/// attributes such that changes may be undone by use of `restore`. To
		/// save stage changes, use `saveStaged`.
		var Model = Obj.extend({
			isCreated: true,
			isEditing: false,
			isSelected: false,
			/// @construct
			/// Create the model
			initialize: function () {
				var that = this;
				this._updateNewAttributes();
				this.on('change', function () {
					that._updateNewAttributes();
				});
			},
			_updateNewAttributes: function () {
				if (!this.isEditing) {
					this.stagedAttributes = _.clone(this.attributes);
				}
			},
			///
			/// Create an obj in the box based on this model, saving its
			/// attributes as the obj attributes. This will trigger `created`
			/// when completed.
			create: function () {
				var promise = $.Deferred(),
					that = this;
				//console.log('creating item');
				this.box.getObj(this.id)
					.then(function (newObj) {
						console.log('new item');
						newObj.save(that.stagedAttributes)
							.then(function () {
								console.log('saved');
								promise.resolve();
								that.trigger('created', newObj);
							});
					});
				return promise;
			},

			/// @then When model has been destroyed
			///
			/// Destroy the model and it's associated object. Triggers
			/// `restore` when destroyed.
			remove: function () {
				//console.log('remove item', this);
				return this.restore().destroy();
			},
			/// @chain
			///
			/// Set the model to edit mode. In this mode, the stagedAttributes
			/// attribute may be written to to "stage" changes. To save these
			/// changes, call `saveStaged`, or call `restore` to cancel.
			/// Check if a model is being edited using isEditing attribute.
			/// Triggers `edit`.
			edit: function (_isCreated) {
				if (!this.isEditing) {
					//console.log('edit item', this);
					this._updateNewAttributes();
					if (!_.isUndefined(_isCreated)) {
						this.isCreated = _isCreated;
					}
					this.isEditing = true;
					this.trigger('edit');
				}
				return this;
			},
			/// @then (<Box>) When model has been saved or created successfully
			/// @fail
			///   (<{ code: 409 }> response) box already exists
			///   (<{ code: -1, error: error obj }> response) other error
			///
			/// Take all staged changes in stagedAttributes attribute and save
			/// them to the obj. If the obj has not been created yet it will
			/// be created.
			saveStaged: function () {
				var that = this;
				//console.log('stage and save');
				if (!this.isCreated) {
					console.log('new, so create');
					return this.create();
				} else {
					console.log('save')
					return this.save(this.stagedAttributes)
						.then(function () {
							//console.log('saved');
							that.restore();
							// u.safeApply($scope); TODO
						});
				}
			},
			///
			/// @opt <{}> attributes: Attributes to change
			/// @opt <{}> options
			///
			/// @then When model has been created successfully
			///
			/// Make a new instance of the model. When the model is saved,
			/// it will be put in the box as an obj and appended to the array.
			save: function () {
				if (!this.isCreated) {
					console.warn('supressing save');
				} else {
					return Backbone.Model.prototype.save.apply(this, arguments);
				}
			},
			/// @chain
			/// Switch off edit mode. Triggers `restore`.
			restore: function () {
				this.isEditing = false;
				this.trigger('restore');
				return this;
			},
			/// @opt <boolean> selected: If true, select the model, otherwise unselect it.
			/// @opt <{}> options
			///
			/// Selects this model. Triggers `select` with selected boolean and options.
			select: function (selected, options) {
				options = options || {};
				//console.log('select', selected);
				selected = _.isBoolean(selected) ? selected : true;
				if (this.isSelected !== selected) {
					//console.log('selecting', selected);
					this.isSelected = selected;
					this.trigger('select', selected, options);
				}
			},
			/// @arg key <string|int>: Key of attribute
			/// @return value
			///
			/// Get the value of an attribute. Use this instead of `get` if
			/// you don't want the value in an array.
			getAttribute: function (key) {
				var val = this.attributes[key];
				return getOnlyElement(val);
			},
			/// @arg key <string|int>: Key of attribute
			/// @return value
			///
			/// Get the value of a staged attribute in edit mode.
			getStagedAttribute: function (key) {
				if (!this.stagedAttributes) { return; }
				var val = this.stagedAttributes[key];
				return getOnlyElement(val);
			},
			/// @arg key <string|int>: Key of attribute
			/// @return value
			///
			/// Get a staged attribute in edit mode.
			getStaged: function (key) {
				if (!this.stagedAttributes) { return; }
				return this.stagedAttributes[key];
			},
			/// @arg attributes <{ key: value }>: object of key value pairs
			/// @chain
			///
			/// Set a staged attribute in edit mode. May also be passed key,
			/// value as arguments.
			setStaged: function (attributes, val) {
				if (_.isObject(attributes)) {
					_.each(attributes, function (val, key) {
						that.setStaged(key, val);
					});
				} else {
					var key = attributes;
					this.stagedAttributes[key] = val;
				}
				return this;
			}
		});

		var getOnlyElement = function (arr) {
			if (_.isArray(arr) && arr.length === 1) {
				return _.first(arr);
			}
			return arr;
		};

		///
		var Collection = Backbone.Collection.extend({
			/// the collection.Model the cast each model to
			model: Model,
			selected: undefined,
			/// @construct
			initialize: function (models, options) {
				var that = this;
				this.options = options || {};
				this.box = this.options.box;
				this.obj = this.options.obj;
				this
					.on('add remove', function () {
						//console.log('something in the collection has changed');
						that.save();
					})
					.on('add remove reset', function () {
						that._setNewModel(that._newModel);
					})
					.on('change', function () {
						that.sort();
					})
					.on('sort', function () {
						that._setNewModel(that._newModel);
					})
					.on('add reset', function (models) {
						if (!models) {
							return;
						}
						if (models.models) { // collection
							models = models.models;
						} else { //model
							models = [models];
						}
						_.each(models, function (model) {
							that.trigger('addAny', model);
						});
					});
				this.reset(models);
				this.populate();
				this._setNewModel();
			},
			/// Attribute or function which returns the id to give to a new model
			modelId: function () {
				return Math.random();
			},
			/// Attribute or function which returns the options to give to a new model
			modelOption: function () {
				return {};
			},
			///
			/// @opt <{}> attributes Attributes of new model
			/// @opt <{}> options select
			///
			/// @return <model> Model inheriting collection.model
			///
			/// Make a new instance of the model. When the model is saved,
			/// it will be put in the box as an obj and appended to the array.
			newModel: function (attributes, options) {
				var that = this,
					model,
					id = _.result(this, 'modelId'),
					soptions = _.result(this, 'modelOptions');

				attributes = _.extend({
					id: id
				}, attributes);
				options = _.extend({}, soptions, options);
				model = new Backbone.Model(attributes, options); // Leave casting to this.model until later
				this._extendModel(model, options);

				this._setNewModel(model);

				model
					.edit(false)
					.set({
						timestamp: now()
					})
					.on('created', function (model) {
						//console.log('going for the add');
						that.add(model);
						that._setNewModel();
						if (options.select) {
							model.select();
						}
						model.trigger('restore'); // TODO .restore()?
					})
					.on('restore', function () {
						that._setNewModel();
						if (options.select) {
							that.selected = undefined;
						}
					});

				if (options && options.select) {
					model.select(true, {
						save: false
					});
				}
				return model;
			},
			_setNewModel: function (model) {
				this._newModel = model;
				if (model) {
					this.trigger('addAny', model);
					this.allModels = [model].concat(this.models);
				} else {
					this.allModels = this.models;
				}
				this.filter();
			},
			/// Remove the model from the array
			remove: function (model) {
				//console.log('!!!remove!!!', arguments);
				if (this.selected === model) {
					this.selected = undefined;
				}
				return Backbone.Collection.prototype.remove.apply(this, arguments);
			},
			_extendModel: function (model, options) {
				var that = this,
					prototype = this.model.prototype;
				_.extend(model, prototype);
				if (prototype.initialize) {
					prototype.initialize.apply(model, options);
				}
				if (prototype.defaults) {
					_.defaults(model.attributes, prototype.defaults);
				}
				model.box = this.box;
				model
					.on('select', function (selected, options) {
						options = options || {};
						if (selected && that.selected === model) {
							return;
						}
						if (that.selected) {
							that.selected.select(false);
						}
						if (selected) {
							that.selected = model;
							that.trigger('select', model);
						}
						if (options.save !== false &&
							(that.options.saveSelected || that.options.syncSelected)) {
							model.save({
								selected: selected
							});
							that.each(function (m) {
								if (m !== model && pop(m.get('selected'))) {
									m.save({
										selected: false
									});
								}
							});
						}
					})
					.on('restore', function () {
						that.trigger('update');
					});
				/*
				model.on('destroyed', function () { // TODO: unbind to prevent memory leaks
					console.log('detected destroy, removing model');
					that.remove(model);
				});*/
			},
			add: function (model, options) {
				var that = this;
				if (_.isArray(model)) {
					_.each(model, function (model) {
						that.add(model, options);
					});
				} else {
					if (!_.isObject(model)) {
						console.warn('There was a non-object stored??', model);
						return;
					}
					//console.log('adding', model)
					this._extendModel(model);
					if (this.options.saveSelected || this.options.syncSelected) {
						if (pop(model.get('selected')) === true) {
							model.select();
						}
						if (this.options.syncSelected) {
							model.on('change:selected', function () {
								model.select(pop(model.get('selected')));
							});
						}
					}
					return Backbone.Collection.prototype.add.apply(this, arguments);
				}
			},
			/// Fetch the object and update the collection with models in the array
			fetch: function () {
				var that = this,
					promise = $.Deferred();
				this.obj.fetch()
					.then(function () {
						that.populate();
						promise.resolve(that);
					});
				return promise;
			},
			/// Update the collection with models in the array. This will happen automatically when the array changes.
			populate: function () {
				if (!this.obj || !this.options.arrayKey) {
					return;
				}
				var that = this,
					obj = this.obj,
					arrayKey = this.options.arrayKey,
					arr = obj.get(arrayKey) || [];
				this.reset(arr);
				obj.on('change:' + arrayKey, function (obj, arr) {
					//console.log('updating list -->', arguments);
					that.add(arr, {
						merge: true,
						silent: true
					});
					var ids = _.pluck(arr, 'id');
					that.remove(that.select(function (model) {
						return ids.indexOf(model.id) < 0;
					}), {
						silent: true
					});
					if (that.selected) {
						that.selected.select();
					}
					that.trigger('reset');
				});
			},
			/// Save the obj with the current array state. This will happen automatically when the array changes.
			save: function () {
				var that = this,
					promise = $.Deferred(),
					arrayKey = that.options.arrayKey;
				//console.log('trying to save list = ', that.models);
				this.obj.save(arrayKey, that.models)
					.then(function () {
						promise.resolve();
					})
					.fail(function () {
						promise.reject('Could not save');
					});
				return promise;
			},
			filter: function (fn) {
				if (fn) {
					this._filterFn = fn;
				}
				if (this._filterFn) {
					this.filteredModels = _.filter(this.allModels, fn);
				} else {
					this.filteredModels = this.allModels;
				}
				this.trigger('update', this);
				return this;
			},
			comparator: function (m) {
				return m.id;
			},
			move: function (item, collection) {
				this.copy(item, collection);
				this.remove(item);
			},
			copy: function (item, collection) { // actually a link
				collection.add(item);
			}
		});

		var now = function () {
			return (new Date())
				.valueOf();
		};
		var pop = function (arr) {
			if (!_.isArray(arr)) {
				return arr;
			}
			return _.first(arr);
		};

		return {
			Model: Model,
			Collection: Collection,
			now: now
		};

	});