/* global angular, console, Backbone, _, $ */

/// @title indx-staged
/// @author Peter West <peter@peter-west.co.uk>
/// @version 0.1

angular
	.module('indx')
	.factory('staged', function () {
		'use strict';

		var cloneAttributes = function (attributes) {
			var _attributes = {};
			_.each(attributes, function (v, k) {
				_attributes[k] = _.clone(v);
			});
			return _attributes;
		};

		var areAttributesDifferent = function (attribute1, attribute2) {
			if (typeof attribute1 !== 'object') { attribute1 = [attribute1]; }
			if (typeof attribute2 !== 'object') { attribute2 = [attribute2]; }
			return _.reduce(attribute1, function (memo, v, k) {
				return memo || v !== attribute2[k];
			}, attribute1.length !== attribute2.length)
		};
		var Staged = Backbone.Model.extend({
			initialize: function (attrs, options) {
				this.obj = options.obj;
				this.obj.on('change', this.reset, this)
				this.reset();
			},
			reset: function () {
				this.set(cloneAttributes(this.obj.attributes));
				return this;
			},
			hasChanged: function () {
				var that = this,
					keys = _.union(_.keys(this.attributes), _.keys(this.obj.attributes));
				console.log(keys)
				return _.reduce(keys, function (memo, key) {
					return memo || areAttributesDifferent(that.attributes[key], that.obj.attributes[key]);
				}, false);
			},
			commit: function () {
				this.obj.set(cloneAttributes(this.attributes));
				return this;
			},
			save: function () {
				return this.obj.save(cloneAttributes(this.attributes));
			}
		});

		return function (obj) {
			obj.staged = new Staged(undefined, { obj: obj });
		};

	});

