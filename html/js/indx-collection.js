/* global angular, console, Backbone, _, $ */

/// @title indx-collection
/// indx-collection makes it easier to deal with arrays stored in indx by
/// using Backbone. It allows arrays to be managed using Collections and objs
/// to be managed using Models, both of which are extensions of Backbone's
/// Collection and Model classes.

angular
	.module('indx')
	.factory('collection', function (client) {
		'use strict';

		var Obj = client.Obj;

		/// A model is an extension of indx Obj, and adds functionality useful
		/// for maintaining collections or objs.
		///
		/// It also provides states which may be useful in developing views -
		/// a model may be being edited (is_editing), selected (is_selected)
		/// or not yet created (is_new). While being edited (or new),
		/// staged_attributes may be written to instead of attributes such
		/// that changes may be undone by use of `restore`. To save stage
		/// changes, use `save_staged`.
		var Model = Obj.extend({
			is_new: false,
			is_editing: false,
			is_selected: false,
			/// @constructor
			initialize: function () {
				var that = this;
				this._update_new_attributes();
				this.on('change', function () {
					that._update_new_attributes();
				});
			},
			_update_new_attributes: function () {
				if (!this.is_editing) {
					this.staged_attributes = _.clone(this.attributes);
				}
			},
			/// @chain
			///
			/// Create an obj in the box based on this model, saving its
			/// attributes as the obj attributes. This will trigger `created`
			/// when completed.
			create: function () {
				var that = this;
				console.log('creating item');
				this.box.get_obj(this.id)
					.then(function (new_obj) {
						console.log('new item');
						new_obj.save(that.staged_attributes)
							.then(function () {
								console.log('saved');
								that.trigger('created', new_obj);
							});
					});
				return this;
			},

			/// @then When model has been destroyed
			///
			/// Destroy the model and it's associated object. Triggers
			/// `restore` when destroyed.
			remove: function () {
				var that = this;
				console.log('remove item', this);
				return this.destroy()
					.then(function () {
						console.log('destroyed item');
						that.trigger('restore', this);
					});
			},
			/// @chain
			///
			/// Set the model to edit mode. In this mode, the staged_attributes
			/// attribute may be written to to "stage" changes. To save these
			/// changes, call `save_staged`, or call `restore` to cancel.
			/// Check if a model is being edited using is_editing attribute.
			/// Triggers `edit`.
			edit: function (_is_new) {
				if (!this.is_editing) {
					console.log('edit item', this);
					this._update_new_attributes();
					this.is_new = _is_new;
					this.is_editing = true;
					this.trigger('edit');
				}
				return this;
			},
			/// @then (<Box>) When model has been saved or created successfully
			/// @fail
			///   (<{ code: 409 }> response) box already exists
			///   (<{ code: -1, error: error obj }> response) other error
			///
			/// Take all staged changes in staged_attributes attribute and save
			/// them to the obj. If the obj has not been created yet it will
			/// be created.
			save_staged: function () {
				var that = this;
				console.log('stage and save');
				if (this.is_new) {
					console.log('new, so create');
					return this.create();
				} else {
					return this.save(this.staged_attributes)
						.then(function () {
							console.log('saved');
							that.restore();
							// u.safe_apply($scope); TODO
						});
				}
			},
			///
			/// @opt <{}> attributes Attributes to change
			/// @opt <{}> options
			///
			/// @then When model has been created successfully
			///
			/// Make a new instance of the model. When the model is saved,
			/// it will be put in the box as an obj and appended to the array.
			save: function () {
				if (this.is_new) {
					console.warn('supressing save');
				} else {
					return Backbone.Model.prototype.save.apply(this, arguments);
				}
			},
			/// Switch off edit mode. Triggers `restore`.
			restore: function () {
				this.is_editing = false;
				this.trigger('restore');
				return this;
			},
			/// @opt <boolean> selected If true, select the model, otherwise unselect it.
			/// @opt <{}> options
			///
			/// Selects this model. Triggers `select` with selected boolean and options.
			select: function (selected, options) {
				options = options || {};
				console.log('select', selected);
				selected = _.isBoolean(selected) ? selected : true;
				if (this.is_selected !== selected) {
					console.log('selecting', selected);
					this.is_selected = selected;
					this.trigger('select', selected, options);
				}
			},
			/// Get the value of an attribute. Use this instead of `get` if
			/// you don't want the value in an array.
			get_attribute: function (key) {
				var val = this.attributes[key];
				return get_only_element(val);
			},
			/// Get the value of a staged attribute in edit mode.
			get_staged_attribute: function (key) {
				var val = this.staged_attributes[key];
				return get_only_element(val);
			}
		});

		var get_only_element = function (arr) {
			if (_.isArray(arr) && arr.length === 1) {
				return _.first(arr);
			}
			return arr;
		};

		var Collection = Backbone.Collection.extend({
			/// the collection.Model the cast each model to
			model: Model,
			selected: undefined,
			initialize: function (models, options) {
				var that = this;
				this.options = options || {};
				this.box = this.options.box;
				this.obj = this.options.obj;
				this
					.on('add remove', function () {
						console.log('something in the collection has changed');
						that.save();
					})
					.on('add remove reset', function () {
						that._set_new_model(that._new_model);
					})
					.on('change', function () {
						that.sort();
					})
					.on('sort', function () {
						that._set_new_model(that._new_model);
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
							model.trigger('add_any', model);
						});
					});
				this.reset(models);
				this.populate();
				this._set_new_model();
			},
			/// Attribute or function which returns the id to give to a new model
			model_id: function () {
				return Math.random();
			},
			/// Attribute or function which returns the options to give to a new model
			model_option: function () {
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
			new_model: function (attributes, options) {
				var that = this,
					model,
					id = _.result(this, 'model_id'),
					soptions = _.result(this, 'model_options');

				attributes = _.extend({
					id: id
				}, attributes);
				options = _.extend(_.clone(soptions), options);
				model = new Backbone.Model(attributes, options); // Leave casting to this.model until later
				this._extend_model(model);

				model
					.edit(true)
					.set({
						timestamp: now()
					})
					.on('created', function (model) {
						console.log('going for the add');
						that.add(model);
						that._set_new_model();
						if (options.select) {
							model.select();
						}
						model.trigger('restore');
					})
					.on('restore', function () {
						that._set_new_model();
						if (options.select) {
							that.selected = undefined;
						}
					});
				this._set_new_model(model);
				if (options && options.select) {
					model.select(true, {
						save: false
					});
				}
				return model;
			},
			_set_new_model: function (model) {
				this._new_model = model;
				this.all_models = model ? [model].concat(this.models) : this.models;
				this.filter();
			},
			/// Remove the model from the array
			remove: function (model) {
				console.log('!!!remove!!!', arguments);
				if (this.selected === model) {
					this.selected = undefined;
				}
				return Backbone.Collection.prototype.remove.apply(this, arguments);
			},
			_extend_model: function (model) {
				var that = this,
					prototype = this.model.prototype;
				_.extend(model, prototype);
				if (prototype.initialize) {
					prototype.initialize.apply(model);
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
							(that.options.save_selected || that.options.sync_selected)) {
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
					console.log('adding', model)
					this._extend_model(model);
					if (this.options.save_selected || this.options.sync_selected) {
						if (pop(model.get('selected')) === true) {
							model.select();
						}
						if (this.options.sync_selected) {
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
				if (!this.obj || !this.options.array_key) {
					return;
				}
				var that = this,
					obj = this.obj,
					array_key = this.options.array_key,
					arr = obj.get(array_key) || [];
				this.reset(arr);
				obj.on('change:' + array_key, function (obj, arr) {
					console.log('updating list -->', arguments);
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
					that.trigger('reset');
				});
			},
			/// Save the obj with the current array state. This will happen automatically when the array changes.
			save: function () {
				var that = this,
					promise = $.Deferred(),
					array_key = that.options.array_key;
				console.log('trying to save list = ', that.models);
				this.obj.save(array_key, that.models)
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
					this._filter_fn = fn;
				}
				if (this._filter_fn) {
					this.filtered_models = _.filter(this.all_models, fn);
				} else {
					this.filtered_models = this.all_models;
				}
				this.trigger('update', this);
				return this;
			},
			comparator: function () {
				return 1;
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