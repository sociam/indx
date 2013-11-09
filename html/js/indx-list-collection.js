/* global angular, console, Backbone, _, $ */

/// @title indx-list-collection
/// @author Peter West <peter@peter-west.co.uk>
/// @version 0.1
///

angular
	.module('indx')
	.factory('listcollection', function (client) {
		'use strict';

		var Collection = Backbone.Collection.extend({
			initialize: function (models, options) {
				var that = this;
				options = options || {};
				this._box = options.box;
				this._obj = options.obj;
				this._key = options.arrayKey;
				if (this._obj) {
					this.populate();
					this._obj.on('change:' + this._key, function (obj, arr) {
						that.softReset(arr);
					});
				}
			},

			// If models already exist update them
			softReset: function (models) {
				console.log('soft reset', models);

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

				console.log('to update', toUpdate)

				try{
				_.each(toUpdate, function (model) {
					console.log('update', model)
					console.log('id', model.id, that, that.models.length, that.get)
					console.log('update', that.get(model.id))
					that.get(model.id).set(model.toJSON());
				});
			}catch(e){e, console.error(e.stack)}

				this
					.add(toAdd, { silent: true })
					.remove(toRemove, { silent: true })
					.trigger('reset');

				return this;
			},

			populate: function () {
				var arr = this._obj.get(this._key) || [];
				console.log('populate', arr, this._key);
				return this.reset(arr);
			},

			fetch: function () {
				console.log('fetch')
				var that = this;
				return this._obj.fetch().then(function () {
					that.populate();
				});
			},

			save: function () {
				console.log('save', this.models)
				return this._obj.save(this._key, this.models);
			},

			add: function (model, options) {
				var that = this;
				if (_.isArray(model)) {
					_.each(model, function (model) {
						that.add(model, options);
					});
					return this;
				} else {
					if (!_.isObject(model)) {
						console.warn('Found non-object in array -->', model);
						return;
					}
					console.log('adding', model)
					this._extendModel(model);
					return Backbone.Collection.prototype.add.apply(this, arguments);
				}
			},

			_extendModel: function (model, options) {
				console.log('extend', model)
				var prototype = this.model ? this.model.prototype : {};

				_.extend(model, prototype);

				if (prototype.initialize) {
					prototype.initialize.apply(model, options);
				}
				if (prototype.defaults) {
					_.defaults(model.attributes, prototype.defaults);
				}

				model.box = this.box;

				return model;
			},
		});

		var Model = Backbone.Model.extend({

		});

		return {
			Collection: Collection,
			Model: Model
		}

	});