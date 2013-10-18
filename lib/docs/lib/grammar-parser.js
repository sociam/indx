/* jshint node:true */
(function () {
	'use strict';

	var fs = require('fs'),
		path = require('path'),
		_ = require('underscore'),
		Promise = require('node-promise').Promise,
		allPromises = require('node-promise').all,
		peg = require('pegjs');

	var GrammarParser = function (grammarFile) {
		var that = this;
		this.loaded = new Promise();
		readGrammar(grammarFile)
			.then(function (grammar) {
				that.parser = peg.buildParser(grammar);
				that.loaded.resolve();
			});
	};

	var readGrammar = function (grammarFile) {
		var promise = new Promise();
		fs.readFile(grammarFile, function (err, data) {
			if (err) {
				throw err;
			}
			var grammar = data.toString(),
				promises = [];

			grammar = grammar.replace(/^@import\s+"([^"]+)"/, function (match,
				filename) {
				var promise = new Promise();
				promises.push(promise);
				readGrammar(path.dirname(grammarFile) + '/' + filename)
					.then(function (includedGrammer) {
						grammar = includedGrammer + grammar;
						promise.resolve();
					});
				return '';
			});
			allPromises(promises)
				.then(function () {
					promise.resolve(grammar);
				});
		});
		return promise;
	};

	_.extend(GrammarParser.prototype, {
		parse: function (text) {
			var that = this,
				promise = new Promise();

			this.loaded.then(function () {
				var rs = that.parser.parse(text);
				promise.resolve(rs);
			});

			return promise;
		}
	});

	module.exports = GrammarParser;

}());