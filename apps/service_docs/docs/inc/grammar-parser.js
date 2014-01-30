/* jshint node:true */
(function () {
	'use strict';

	var fs = require('fs'),
		path = require('path'),
		_ = require('underscore'),
		Q = require('q'),
		peg = require('pegjs');

	var GrammarParser = function (grammarFile) {
		var that = this;
		this.loaded = Q.defer();
		readGrammar(grammarFile)
			.then(function (grammar) {
				that.parser = peg.buildParser(grammar);
				that.loaded.resolve();
			});
	};

	var readGrammar = function (grammarFile) {
		var deferred = Q.defer();
		fs.readFile(grammarFile, function (err, data) {
			if (err) {
				throw err;
			}
			var grammar = data.toString(),
				promises = [];

			grammar = grammar.replace(/^@import\s+"([^"]+)"/, function (match,
				filename) {
				var deferred = Q.defer();
				promises.push(deferred.promise);
				readGrammar(path.dirname(grammarFile) + '/' + filename)
					.then(function (includedGrammer) {
						grammar = includedGrammer + grammar;
						deferred.resolve();
					});
				return '';
			});
			Q.all(promises)
				.then(function () {
					deferred.resolve(grammar);
				});
		});
		return deferred.promise;
	};

	_.extend(GrammarParser.prototype, {
		parse: function (text) {
			var that = this,
				deferred = Q.defer();

			this.loaded.promise.then(function () {
				try {
					var rs = that.parser.parse(text);
					deferred.resolve(rs);
				} catch (e) {
					console.log('ERRR', text, e)
					deferred.reject();
				}
			});

			return deferred.promise;
		}
	});

	module.exports = GrammarParser;

}());