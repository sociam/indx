/* global angular, console, Backbone, _, $ */

/// @title indx-list-collection
/// @author Peter West <peter@peter-west.co.uk>
/// @version 0.1
///

angular
	.module('indx')
	.factory('listcollection', function (client) {
		'use strict';

		var Model = Backbone.Model.extend({
			set: function (attributes, options) {
				var that = this,
					defaults = _.result(that, 'defaults');
				if (typeof attributes === "string") {
					var o = {};
					o[attributes] = options; // o[key] = value
					return this.set(o);
				}
				attributes = _(attributes).clone();
				_(attributes).each(function (value, key) {
					if (key === '@id') { return; }
					if (key === 'id') { return; }
					if (!_.isArray(value)) {
						throw 'Value must be an array (' + (typeof value) + ' given)';
					}
					// If this is a value from the defaults object, use a clone
					if (defaults && defaults[key] === value) {
						attributes[key] = _(value).clone();
					}
				});
				return Backbone.Model.prototype.set.call(this, attributes, options);
			}
		});

		var colors = ['orange', 'magenta', 'cyan', 'green'],
			colorHash = {};
		var logColor = function (args) {
			var color = colorHash[args[0]];
			if (!color) {
				color = colors[_(colorHash).keys().length];
				colorHash[args[0]] = color;
			}
			if (color) {
				args[0] = '%c' + args[0];
				args.splice(1, 0, 'color:' + color + ';');
			}
			return args;
		}

		var Collection = Backbone.Collection.extend({
			model: Model,

			log: function () {
				var stack = function () {
					try { throw new Error(''); }
					catch (e) { return e.stack; }
				}
				var location = stack().split('\n')[3].split(/:|\//).slice(-3, -1).join(':'),
					args = Array.prototype.slice.call(arguments, 0),
					len = _(args).reduce(function (memo, arg) {
						return memo + String(arg).length + 1;
					}, 0),
					pad = _(50 - len).times(function () { return ' '; }).join('');

				args.unshift('collection:' + this._key);

				args.push(pad + '[' + location + ']');
				console.info.apply(console, logColor(args));
			},

			/// EVENT: trigger change when array has changed

			initialize: function (models, options) {
				var that = this;
				options = options || {};
				this.box = options.box;
				this.obj = options.obj;
				this._key = options.arrayKey;

				this.on('all', function (e) {
					that.log('fired:' + e);
				});

				if (this.obj) {
					var models = this.obj.get(this._key) || [];
					this.reset(models);
					this.obj.on('change:' + this._key, function (obj, models) {
						that.reset(models);
						that.trigger('change');
					});
				}

				this.on('fetch', function () {
					that.trigger('change');
				});

			},

			// If models already exist update them
			reset: function (models) {
				this.log('reset', models.length, 'models');

				var that = this,
					currentIDs = _.pluck(this.models, 'id'),
					newIDs = _.pluck(models, 'id'),
					toAdd = _(models).filter(function (model) {
						return currentIDs.indexOf(model.id) < 0;
					}),
					toUpdate = _(this.models).filter(function (model) {
						return newIDs.indexOf(model.id) > -1;
					}),
					toRemove = _(this.models).filter(function (model) {
						return newIDs.indexOf(model.id) < 0;
					});

				this.log('add: ' + toAdd.length + ', update: ' + toUpdate.length + ', remove: ' + toRemove.length)

				_.each(toUpdate, function (model) {
					that.get(model.id).set(model.toJSON());
				});

				this.add(toAdd)
					.remove(toRemove)
					.trigger('reset');

				return this;
			},

			fetch: function () {
				var that = this;
				this.log('fetch')
				return this.obj.fetch().then(function () {
					that.trigger('fetch', that, that.models);
				});
			},

			save: function () {
				this.log('save', this.models.length, 'models', 'box version', this.box.getVersion());
				return this.obj.save(this._key, this.models);
			},

			add: function (models, options) {
				var that = this;
				options = _.extend({ }, options);

				if (!_(models).isArray()) {
					models = [models];
				}
				_.each(models, function (model) {
					if (!_(model).isObject()) {
						console.warn('Found non-object in array -->', model);
						return;
					}
					that._extendModel(model);
					that.log('adding', model.id)
					Backbone.Collection.prototype.add.call(that, model, options);
				});
				if (options.save) { that.save(); }
				return this;
			},

			remove: function (model, options) {
				options = _.extend({ }, options);
				Backbone.Collection.prototype.remove.apply(this, arguments);
				if (options.save) { that.save(); }
				return this;
			},

			_extendModel: function (model, options) {
				this.log('extend', model.id)
				var prototype = this.model ? this.model.prototype : {};

				_.extend(model, prototype);

				model.box = this.box;
				model.collection = this;

				if (prototype.initialize) {
					prototype.initialize.apply(model, options);
				}
				if (prototype.defaults) {
					_.defaults(model.attributes, prototype.defaults);
				}

				return model;
			},

			///
			/// Create an obj in the box based on this model, saving its
			/// attributes as the obj attributes. This will trigger `created`
			/// when completed.
			create: function (attributes, options) {
				var promise = $.Deferred(),
					that = this;
				//that.log('creating item');
				this.box.getObj(attributes.id)
					.then(function (newObj) {
						that.log('new item', attributes.id);
						var nattributes = _.clone(attributes);
						delete nattributes.id;
						newObj.save(nattributes)
							.then(function () {
								var noptions = _.extend({ save: true }, options);
								that.log('saved');
								promise.resolve();
								that.add(newObj, noptions)
								that.trigger('created', newObj);
							});
					});
				return promise;
			}
		});

		return {
			Collection: Collection,
			Model: Model
		}

	});