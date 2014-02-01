/* global angular, console, Backbone, _, $ */

/// @title indx-staged
/// @author Peter West <peter@peter-west.co.uk>
/// @version 0.1

angular
	.module('indx')
	.factory('staged', function (client) {
		'use strict';

		var cloneAttributes = function (attributes) {
			var _attributes = {};
			_.each(attributes, function (v, k) {
				_attributes[k] = _.clone(v);
			});
			return _attributes;
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