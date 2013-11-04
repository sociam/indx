/* jshint node:true */
(function () {

	'use strict';
	var fs = require('fs'),
		_ = require('underscore'),
		GrammarParser = require('./lib/grammar-parser.js'),
		Q = require('q'),
		u = require('utils.js'),
		Classes = require('classes.js');
		


	var File = u.Model.extend({
		grammar: new GrammarParser(u.relativeTo('grammars/file-grammar.peg', __dirname)),
		tags: {
			'title': { validate: function (str) { return typeof str === 'string'; } },
			'version': {},
			'author': { repeatable: true },
			'since': {},
			'see': { repeatable: true }
		},
		initialize: function (attributes, options) {
			u.Model.prototype.initialize.apply(this, arguments);
			this.builder = options.builder;
		},
		parse: function () {
			var that = this;
			u.log('READ FILE', this.get('filename'));
			fs.readFile(this.get('filename'), function (err, data) {
				u.log('PARSE FILE', that.get('filename'));
				if (err) {
					throw err;
				}
				that.data = data.toString();
				that.classes = new Classes(undefined, {
					builder: that.builder,
					file: that,
					data: that.data
				});
				that.parseComment()
					.then(function () {
						that.classes.parse()
							.then(function () {
								that.parsed.resolve();
							});
					});
			});
		},
		parseComment: function () {
			var that = this,
				comment = u.getCommentAfter(this.data, 0),
				deferred = Q.defer();
			this.grammar.parse(comment)
				.then(function (rs) {
					if (!rs.title) {
						rs.title = that.get('filename').split('/').pop();
					}
					u.parseMatch(rs, that)
						.then(function () {
							deferred.resolve();
						});

				});
			return deferred.promise;
		},
		object: function () {
			return _.extend(this.toJSON(), {
				classes: this.classes.array()
			});
		},
		uid: function () {
			return 'file-' + this.get('filename')
				.replace(/\W+/gi, ' ')
				.trim()
				.replace(/ /gi, '-');
		}
	});

	var Files = u.Collection.extend({
		model: File,
		parse: function () {
			return this.parseModels();
		}
	});

	module.exports = Files;
}());