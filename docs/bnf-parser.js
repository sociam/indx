(function () {
	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		Promise = require('node-promise').Promise;

	var comment = [
		'	/// @arg <string|number> boxid',
		'	/// @arg <string | { a: \'valueofa\' } > foo: some comment',
		'	/// @arg arg3: this is an argument with no type specified',
		'	///',
		'	/// Now I\'ll comment on this function...',
		'	///',
		'	/// @then success! :) (<Box> yourbox, <string> name_of_thing, <int> prime_factor)',
		'	/// @fail',
		'	///   box already exists (<{ code: 409 }>)',
		'	///   other error (<{ code: -1, error: <error obj> }>)'
	].join('\n');




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
			regexp = this.compile(regexp);
			console.log(this.str, regexp, this.str.match(new RegExp(regexp)).length>0);
			this.str.replace(new RegExp(regexp), function (match) {
				console.log(arguments);
				return match;
			});
		},
		compile: function (regexp) {
			var that = this;
			//console.log(regexp)
			regexp = regexp.replace(/\{([^}]+)\}/g, function (match, template) {
				return that.compile(that.regexps[template]);
			});
			//console.log(regexp)
			return regexp;
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

	var BnfParser = function (bnfFile, text) {
		var that = this;
		this.loaded = new Promise();
		fs.readFile(bnfFile, function (err, data) {
			that._parse(data.toString());
			that.loaded.resolve();
		});
		this.text = text;
		that.definitions = [];
	};

	_.extend(BnfParser.prototype, {
		_parse: function (bnfText) {
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
		},
		find: function (subject) {
			var promise = new Promise(),
				rs;


			this.loaded.then(function () {
				promise.resolve(rs);
			});
			return promise;
		}
	})

	var bnf = new BnfParser('./bnf', comment);


	bnf.find('methodannotation').then(function (rs) {
		console.log(rs);
	});


}());
