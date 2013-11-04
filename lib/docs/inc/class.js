/* jshint node:true */
(function () {

	'use strict';
	var _ = require('underscore'),
		GrammarParser = require('./lib/grammar-parser.js'),
		Q = require('q'),
		u = require('utils.js'),
		Methods = require('methods.js');
	
	var Class = u.Model.extend({
		grammar: new GrammarParser(u.relativeTo('grammars/class-grammar.peg', __dirname)),
		tags: {
			'class': { empty: true },
			'ignore': { empty: true },
			'extend': { repeatable: true, aliases: ['extends', 'augments'],
				process: function () {} },
			'name': {},
			'fullName': {},
			'order': {},
			'since': {},
			'see': { repeatable: true },
			'deprecated': {},
			'alias': { repeatable: true }
		},
		defaults: {
			extend: false
		},
		initialize: function (attributes, options) {
			this.data = options ? options.data : undefined;
			this.file = options ? options.file : undefined;
			u.Model.prototype.initialize.apply(this, arguments);
			this.methods = new Methods(undefined, {
				cls: this,
				data: this.data
			});

			this.set('instanceName', this.get('name')
				.charAt(0)
				.toLowerCase() +
				this.get('name')
				.substr(1));
			this.regexps = [
				['([^\\s.]*) *(?:=|:) *' + (this.get('fullName') || this.get('name')) +
					'\\.extend\\(',
					function (match, name, pos) {
						return {
							match: match,
							name: name,
							start: pos,
							fullName: name
						};
					}
				]
			];
		},
		parse: function () {
			u.log('parse class', this.get('name'));
			var that = this;

			this.parseComment()
				.then(function () {
					that.methods.parse()
						.then(function () {
							that.parsed.resolve();
						});
				});

		},
		parseComment: function () {
			var that = this,
				comment = u.getCommentBefore(this.data, this.get('start'), true),
				deferred = Q.defer();
			this.grammar.parse(comment)
				.then(function (rs) {
					u.parseMatch(rs, that)
						.then(function () {
							deferred.resolve();
						});
				});
			return deferred.promise;
		},
		object: function () {
			return _.extend(this.toJSON(), {
				methods: this.methods.array()
			});
		},
		uid: function () {
			return (this.file ? this.file.id : '') + '_class-' + this.get('name')
				.replace(/\W+/gi, '');
		}
	});

	var Classes = u.Collection.extend({
		model: Class,
		initialize: function (models, options) {
			var that = this;
			this.builder = options.builder;
			this.file = options.file;
			this.data = options.data;
			this.on('change:order', function () {
				that.sort();
			});
		},
		parse: function (builder) {
			var that = this,
				// we need to reparse when a new potential superclass is found
				reparse = false;
			// Find each class that extends each superclass
			builder.superclasses.each(function (superCls) {
				if (reparse) {
					return;
				}
				u.log('CHECKING FOR INHERITANCE ON', superCls.get('name'));
				_.each(superCls.regexps, function (regexp) {
					if (reparse) {
						return;
					}
					var re = new RegExp(regexp[0], 'g');
					that.data.replace(re, function () {
						if (reparse) {
							return;
						}
						var match = regexp[1].apply(this, arguments);
						// Ignore classes beginning with _
						if (match.fullName.indexOf('_') === 0) {
							return;
						}
						// Has this class already been found?
						if (that.where({ fullName: match.fullName }).length > 0) {
							u.log('Found already', match.fullName);
							return;
						}
						u.log(match.fullName, superCls.get('name'));
						var cls = new Class(_.extend({
							extend: !superCls.atomic ? superCls.object() : undefined
						}, match), {
							data: that.data,
							file: that.file
						});
						that.add(cls);
						builder.superclasses.add(cls);
						reparse = true;
					});

				});
			});

			if (reparse) {
				return this.parse(builder);
			}

			// Infer that the end the each class is the start of the next
			that.each(function (cls, i) {
				if (i > 0) {
					that.at(i - 1)
						.set('end', cls.get('start') - 1);
				}
			});
			// ... or the end of the file
			if (that.length > 0) {
				that.last()
					.set('end', that.data.length - 1);
			}
			// Parse each class
			return this.parseModels();
		},
		comparator: function (m) {
			return m.has('order') ? Number(m.get('order')) : m.get('start');
		}
	});

	var ObjectClass = Class.extend({
		defaults: {
			name: 'Object',
			fullName: 'Object'
		},
		atomic: true,
		initialize: function () {
			Class.prototype.initialize.apply(this, arguments);
			this.regexps = [
				// TODO: a parser might be a better idea
				[
					'[\\s]+((?:[^\\s\\.]+\\s*\\.\\s*)*([A-Z][^\\s\\.]*)) *(?:=|:) *function *\\(([^\\)]*)\\)',
					function (match, fullName, name, n, pos) {
						return {
							match: match,
							name: name,
							fullName: fullName,
							start: pos
						};
					}
				],
				['function\\s*([A-Z][^\\s.]*) *\\(([^\\)]*)\\)',
					function (match, name, pos) {
						return {
							match: match,
							name: name,
							fullName: name,
							start: pos
						};
					}
				]
			];
		}
	});
}());