/* jshint node:true */
(function () {
	'use strict';

	var u = require('./utils.js');

	var Argument = u.Model.extend({
		initialize: function (attributes, options) {
			this.args = options.args;
			this.method = this.collection.method;
			u.Model.prototype.initialize.apply(this, arguments);
		},
		parse: function () {
			u.log('parse argument', this.get('name'));

			this.set('moreInfo', !! this.get('types') || !! this.get('comment'));
			var types = this.get('types');
			if (types && types.length > 0) {
				this.set('hasTypes', true);
				u.muList(types);
			}

			this.parsed.resolve();
		},
		uid: function () {
			return this.method.id + '_argument-' + this.get('name')
				.replace(/\W+/gi, '');
		}
	});

	var Arguments = u.Collection.extend({
		model: Argument,
		initialize: function (models, options) {
			this.method = options.method;
		},
		parse: function () {
			return this.parseModels();
		}
	});

	module.exports = Arguments;
}());
