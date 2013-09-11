/* global console, Backbone, _, $ */
angular
	.module('indx')
	.factory('collection', function () {
		'use strict';

		var Model = function () {};
		Model.extend = function (obj) {
			/// @ignore -- TODO
			var _F = function () {};
			_F.prototype = _.extend({}, Model.prototype, obj);
			return _F;
		};
		_.extend(Model.prototype, {
			is_new: false,
			is_editing: false,
			is_selected: false,
			initialize: function () {
				this.newAttributes = _.clone(this.attributes);
			},
			create: function () {
				var that = this;
				console.log('creating item');
				this.box.get_obj(this.id).then(function (new_obj) {
					console.log('new item');
					new_obj.save(that.newAttributes).then(function () {
						console.log('saved');
						that.trigger('created', new_obj);
					});
				});
				return this;
			},
			remove: function () {
				var that = this;
				console.log('remove item', this);
				this.destroy().then(function () {
					console.log('destroyed item');
					that.trigger('restore', this);
				});
			},
			edit: function (is_new) {
				if (this.is_editing) { return; }
				console.log('edit item', this);
				this.newAttributes = _.clone(this.attributes);
				this.is_new = is_new;
				this.is_editing = true;
				this.trigger('edit');
				return this;
			},
			stage_and_save: function () {
				var that = this;
				console.log('stage and save');
				if (this.is_new) {
					console.log('new, so create');
					return this.create();
				} else {
					this.save(this.newAttributes).then(function () {
						console.log('saved');
						that.restore();
						// u.safe_apply($scope); TODO
					});
				}
			},
			save: function () {
				if (this.is_new) {
					console.warn('supressing save');
				} else {
					return Backbone.Model.prototype.save.apply(this, arguments);
				}
			},
			restore: function () {
				this.is_editing = false;
				this.trigger('restore');
				return this;
			},
			select: function (selected, options) {
				options = options || {};
				console.log('select', selected);
				selected = _.isBoolean(selected) ? selected : true;
				if (this.is_selected !== selected) {
					console.log('selecting', selected);
					this.is_selected = selected;
					this.trigger('select', selected, options);
				}
			}
		});
		var Collection = Backbone.Collection.extend({
			/// the collection.Model the cast each model to
			model: Model,
			selected: undefined,
			initialize: function (models, options) {
				var that = this;
				this.options = options || {};
				this.box = this.options.box;
				this.obj = this.options.obj;
				this.on('add remove', function () {
					console.log('something in the collection has changed');
					that.save();
				}).on('add remove reset', function () {
					that._set_new_model(that._new_model);
				});
				console.log('setting up');
				this.on('change', function () {
					that.sort();
				}).on('sort', function () {
					console.log('!!! sorting !!!')
					that._set_new_model(that._new_model);
				});
				this.reset(models);
				this.populate();
				this._set_new_model();
			},
			///
			/// @opt <{}> attributes Attributes of new model
			/// @opt <{}> options
			///
			/// @return <model> Model inheriting collection.model
			///
			/// Make a new instance of the model. When the model is saved,
			/// it will be put in the box as an obj and appended to the array.
			new_model: function (attributes, options) {
				var that = this,
					model = new Backbone.Model(attributes);
				options = options || {};
				this._extend_model(model);
				model
					.edit(true)
					.set({ timestamp: now() })
					.on('created', function (model) {
						console.log('going for the add');
						that.add(model);
						that._set_new_model();
						if (options.select) { model.select(); }
						model.trigger('restore');
					})
					.on('restore', function () {
						that._set_new_model();
						if (options.select) { that.selected = undefined; }
					});
				this._set_new_model(model);
				if (options.select) { model.select(true, { save: false }); }
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
				if (this.selected === model) { this.selected = undefined; }
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
				model.on('select', function (selected, options) {
					options = options || {};
					if (selected && that.selected === model) { return; }
					if (that.selected) { that.selected.select(false); }
					if (selected) {
						that.selected = model;
						that.trigger('select', model);
					}
					if (options.save !== false &&
							(that.options.save_selected || that.options.sync_selected)) {
						model.save({ selected: selected });
						that.each(function (m) {
							if (m !== model && pop(m.get('selected'))) {
								m.save({ selected: false });
							}
						});
					}
				}).on('restore', function () {
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
					_.each(model, function (model) { that.add(model, options); });
				} else {
					if (!_.isObject(model)) {
						console.warn('There was a non-object stored??', model);
						return;
					}
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
				this.obj.fetch().then(function () {
					that.populate();
					promise.resolve(that);
				});
				return promise;
			},
			/// Update the collection with models in the array. This will happen automatically when the array changes.
			populate: function () {
				if (!this.obj || !this.options.array_key) { return; }
				var that = this,
					obj = this.obj,
					array_key = this.options.array_key,
					arr = obj.get(array_key) || [];
				this.reset(arr);
				obj.on('change:' + array_key, function (obj, arr) {
					console.log('updating list -->', arguments);
					that.add(arr, { merge: true, silent: true });
					var ids = _.pluck(arr, 'id');
					that.remove(that.select(function (model) {
						return ids.indexOf(model.id) < 0;
					}), { silent: true });
					that.trigger('reset');
				});
				//console.log('obj --> ', obj, array_key);
				//console.log('list --> ', arr);
			},
			/// Save the obj with the current array state. This will happen automatically when the array changes.
			save: function () {
				var that = this,
					promise = $.Deferred(),
					array_key = that.options.array_key;
				console.log('trying to save list = ', that.models);
				this.obj.save(array_key, that.models).then(function () {
					promise.resolve();
				}).fail(function () { promise.reject('Could not save'); });
				return promise;
			},
			filter: function (fn) {
				if (fn) { this._filter_fn = fn; }
				if (this._filter_fn) {
					this.filtered_models = _.filter(this.all_models, fn);
				} else {
					this.filtered_models = this.all_models;
				}
				this.trigger('update', this);
				return this;
			}
		});

		var now = function () {
			return (new Date()).valueOf();
		};
		var pop = function (arr) {
			if (!_.isArray(arr)) { return arr; }
			return _.first(arr);
		};

		return {
			Model: Model,
			Collection: Collection,
			now: now
		};

	});