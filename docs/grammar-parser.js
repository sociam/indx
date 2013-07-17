(function () {
	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		Promise = require('node-promise').Promise,
		peg = require('pegjs');

	var comment = [
		'	/// @arg <string|number> boxid',
		'	/// @arg <string | { a: \'valueofa\' } > foo: some comment',
		'	/// @arg arg3: this is an argument with no type specified',

		'	/// @then (<Box> yourbox, <string> name_of_thing, <int> prime_factor) success! :',
		'	/// @fail',
		'	///   (<{ code: 409 }> code) box already exists',
		'	///   (<{ code: -1, error: error obj }> code) other error ',

		'   /// Now I\'ll comment on this function...'
	].join('\n');




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
