(function () {
	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		Promise = require('node-promise').Promise,
		peg = require('pegjs');

	var GrammarParser = function (grammarFile) {
		var that = this;
		this.loaded = new Promise();
		fs.readFile(grammarFile, function (err, data) {
			that.parser = peg.buildParser(data.toString());
			that.loaded.resolve();
		});
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
