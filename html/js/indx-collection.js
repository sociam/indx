/* global console, Backbone, _, $ */
angular
	.module('indx')
	.factory('collection', function () {
		'use strict';

		var Model = function () {};
		Model.extend = function (obj) {
			var F = function () {};
			F.prototype = _.extend({}, Model.prototype, obj);
			return F;
		};
		_.extend(Model.prototype, {
			is_new: false,
			is_editing: false,
			is_selected: false,
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
				console.log('remove item', this);
				this.destroy().then(function () {
					console.log('destroyed item');
					//that.trigger('destroyed', this);
				});
			},
			edit: function (is_new) {
				console.log('edit item', this);
				this.newAttributes = _.clone(this.attributes);
				this.is_new = is_new;
				this.is_editing = true;
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
					that.set_new_model(that._new_model);
				});
				this.reset(models);
				this.populate();
				this.set_new_model();
			},
			new_model: function (attributes, options) {
				var that = this,
					model = new Backbone.Model(attributes);
				options = options || {};
				this.extend_model(model);
				model
					.edit(true)
					.set({ timestamp: now() })
					.on('created', function (model) {
						console.log('going for the add');
						that.add(model);
						that.set_new_model();
						if (options.select) { model.select(); }
					})
					.on('restore', function () {
						that.set_new_model();
						if (options.select) { that.selected = undefined; }
					});
				this.set_new_model(model);
				if (options.select) { model.select(true, { save: false }); }
				return model;
			},
			set_new_model: function (model) {
				this._new_model = model;
				this.all_models = model ? this.models.concat([ model ]) : this.models;
				//console.log('update');
				this.trigger('update', this);
			},
			remove: function (model) {
				console.log('!!!remove!!!', arguments);
				if (this.selected === model) { this.selected = undefined; }
				return Backbone.Collection.prototype.remove.apply(this, arguments);
			},
			extend_model: function (model) {
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
							(that.options.saveSelected || that.options.syncSelected)) {
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
					this.extend_model(model);
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
			fetch: function () {
				var that = this,
					promise = $.Deferred();
				this.obj.fetch().then(function () {
					that.populate();
					promise.resolve(that);
				});
				return promise;
			},
			populate: function () {
				if (!this.obj || !this.options.array_key) { return; }
				var that = this,
					obj = this.obj,
					array_key = this.options.array_key,
					arr = obj.get(array_key) || [];
				this.reset(arr);
				obj.on('change:' + array_key, function (obj, arr) {
					console.log('updating list -->', arguments);
					that.reset(arr);
				});
				//console.log('obj --> ', obj, array_key);
				//console.log('list --> ', arr);
			},
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