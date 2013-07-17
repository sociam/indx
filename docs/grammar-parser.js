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
		'	///   box already exists (<{ code: 409 }>)',
		'	///   other error (<{ code: -1, error: <error obj> }>)',

		'   /// Now I\'ll comment on this function...'
	].join('\n');




	var GrammarParser = function (grammarFile, text) {
		var that = this;
		this.loaded = new Promise();
		fs.readFile(grammarFile, function (err, data) {
			that.parser = peg.buildParser(data.toString());
			that.parsed = that.parser.parse(text);
			console.log(JSON.stringify(that.parsed, ' ', ' '));
			that.loaded.resolve();
		});
		this.text = text;
		that.definitions = [];
	};


	var grammar = new GrammarParser('./grammar', comment);

return;

/*
	var RegExpTemplate = function (str) {
		this.str = str;
		this.regexps = {
			symbol: '<[^>]+>',
			string: '"[^"]*',
			type: '[^\\s"<>]*',
			whitespace: '\\s*',
			expression: '(?:({symbol}|{string}|{type}){whitespace})+',
			definition: '({symbol}){whitespace}::={expression}',
			or: '\\|{expression}'
		};
	};

	_.extend(RegExpTemplate.prototype, {
		match: function (regexp) {
			var found = false;
			regexp = this.compile(regexp);
			this.str.replace(new RegExp(regexp), function (match) {
				found = true;
				return match;
			});
			return found;
		},
		compile: function (regexp) {
			var that = this;
			//console.log(regexp)
			regexp = regexp.replace(/\{([^}]+)\}/g, function (match, template) {
				return that.compile(that.regexps[template]);
			});
			//console.log(regexp)
			return regexp;
		},
		parts: function (regexp) {
			var found = false,
				parts = {};
			regexp = regexp.replace(/\{([^}]+)\}/g, function (match, template) {
				parts[template] = that.parts(that.regexps[template])
				return that.parts
			});
			if (!found) {

			}
			return parts;
		}
	})

	var Definition = function () {

	};

	var LineParser = function (line) {
		this.line = line.trim();
		this.re = new RegExpTemplate(this.line);
	};

	_.extend(LineParser.prototype, {
		isBlank: function () { return this.line.length === 0; },
		isComment: function () { return this.line.indexOf('#') === 0; },
		isDefinition: function () { return this.re.match('{definition}'); },
		isOr: function () { return this.re.match('{or}'); },
		definition: function () {
			return this.re.match('{definition}');
		},
		or: function () {
			return this.re.match('{or}');
		}
	});
*/

	_.extend(GrammarParser.prototype, {
		/*_parse: function (grammarText) {
			var that = this,
				lines = bnfText.split('\n'),
				lastDefinition;

			_.each(lines, function (line, i) {
				var lineP = new LineParser(line);
				if (lineP.isBlank() || lineP.isComment()) {
					return;
				} else if (lineP.isDefinition()) {
					lastDefinition = new Definition(lineP);
					that.definitions.push(lastDefinition);
				} else if (lineP.isOr()) {
					if (!lastDefinition) { throw 'Parsing error on line ' + i; }
					lastDefinition.or(lineP);
				} else {
					if (!lastDefinition) { throw 'Parsing error on line ' + i; }
				}
			});
		},*/
		find: function (subject) {
			var that = this,
				promise = new Promise(),
				rs;

			this.loaded.then(function () {
				that.findGrammarInText(subject, that.text);
				promise.resolve(rs);
			});

			return promise;
		},

		findGrammarInText: function (grammarName, _text, depth) {
			var that = this,
				grammarChoices = that.grammar[grammarName];

			depth = depth || 0;

			if (depth > 3) { return; }

			return _.find(grammarChoices, function (grammar) {
				var matches = [],
					text = _text;
				_.each(grammar, function (grammarPart) {
					var match;
					if (isSymbol(grammarPart)) {
						console.log(grammarPart);
						match = that.findGrammarInText(grammarPart, text, depth + 1);
					} else {
						var regexp = new RegExp('\\s*' + grammarPart + '\\s*');
						match = text.match(regexp);
						if (match) {
							text = text.substr(match.index + match[0].length);
						}
					}
					//if (match) {
						matches.push([ grammarPart, match ]);
					//}
				});
				console.log(matches);
				return matches;
			});
		}
	})

	function isSymbol (str) {
		return str.match('<([^>]+)>');
	}



	grammar.find('<method-annotation>').then(function (rs) {
		console.log(rs);
	});


}());
