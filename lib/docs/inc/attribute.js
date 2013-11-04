/* jshint node:true */
(function () {

	'use strict';

	var _ = require('underscore'),
		GrammarParser = require('./lib/grammar-parser.js'),
		Q = require('q'),
		u = require('../utils.js'),
		Arguments = require('arguments.js');

	var Method = u.Model.extend({
		tags: {
			'attribute': { empty: true },
			'name': {},
			'optional': {},
			'types': {},
			'ignore': { empty: true },
			'order': {},
			'since': {},
			'see': { repeatable: true },
			'deprecated': {},
			'alias': { repeatable: true },
			'default': {}
		}
	});

	module.exports = Method;
	
}}());