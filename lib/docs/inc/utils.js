/* jshint node:true */
(function () {

	'use strict';
	var clc = require('cli-color'),
		_ = require('underscore'),
		Q = require('q'),
		Backbone = require('backbone'),
		marked = require('marked'),
		gu = require('../../utils.js');

	var Model = Backbone.Model.extend({
		defaults: {
			name: '',
			description: '',
			last: false
		},
		initialize: function () {
			this.parsed = Q.defer();
			this.set('id', this.uid ? this.uid() : Math.random());
		},
		afterParsed: function (fn) {
			this.parsed.promise.then(fn);
			return this;
		},
		object: function () {
			return this.toJSON();
		}
	});

	var Collection = Backbone.Collection.extend({
		array: function () {
			return this.map(function (o) {
				return o.object();
			});
		},
		parseModels: function () {
			var that = this,
				deferred = Q.defer();
			if (that.length > 0) {
				this.each(function (model, i) {
					if (i > 0) {
						that.at(i - 1)
							.afterParsed(function () {
								model.parse();
							});
					} else {
						model.parse();
					}
				});
				this.last()
					.set('last', true)
					.afterParsed(function () {
						deferred.resolve();
					});
			} else {
				deferred.resolve();
			}
			return deferred.promise;
		}
	});

	var markedOptions = {
		gfm: true,
		tables: true,
		breaks: false,
		pedantic: false,
		sanitize: true,
		smartLists: true,
		smartypants: false,
		langPrefix: 'lang-'
	};

	var parseMatch = function (rs, model) {
		var deferred = Q.defer();
		
		// Validate properties from description
		var tags = model.tags,
			properties = _.clone(rs.properties);

		_.each(properties, function (values, tag) {
			var tagValidation = tags[tag];
			if (!tagValidation) {
				delete properties[tag];
				warn(tag + ' is not a recognised tag.');
				return;
			}
			if (tagValidation.empty && values.length) {
				warn(tag + ' should be empty, contains ' + values);
			}
			if (!tagValidation.repeatable) {
				if (values.length > 1) {
					warn(tag + ' is not repeatable (found ' + values.length + ' matches). Taking first element only.');
				}
				properties[tag] = _(values).first();
			}
		});

		// Merge in properties from description
		_.extend(rs, properties);
		delete rs.properties;

		if (rs.hasOwnProperty('ignore')) {
			model.collection.remove(model);
		}
		marked(rs.description.join('\n'), markedOptions, function (err, content) {
			if (err) {
				throw err;
			}
			rs.description = content;
			model.set(rs);
			deferred.resolve(rs);
		});
		return deferred.promise;
	};

	var logging = false;
	var setLogging = function (_logging) {
		logging = _logging;
	};

	var log = function (context, message, force) {
		if (typeof message === 'boolean') {
			force = message;
			message = undefined;
		}
		if (logging === false && !force && context !== 'warning') { return; }
		if (!message) {
			message = context;
			context = '';
		}
		var color =
			context.indexOf('class') > -1 ? clc.xterm(48) :
			context.indexOf('method') > -1 ? clc.xterm(43) :
			context.indexOf('argument') > -1 ? clc.xterm(38) :
			context.indexOf('file') > -1 ? clc.xterm(33) :
			context.indexOf('warning') > -1 ? clc.xterm(227) : clc.xterm(227);
		context = context ? color(pad(tree(context), 15)) + ' ' : '';
		console.log(context, message);
	};

	var warnings = 0;

	var warn = function (msg) {
		var color = clc.xterm(0).bgXterm(226);
		console.log(color(msg));
		warnings++;
	};

	var summary = function () {
		console.log(warnings + ' warnings');
	};

	var tree = function (context) {
		return (
			context.indexOf('file') > -1 ? '+-' :
			context.indexOf('class') > -1 ? '| +-' :
			context.indexOf('method') > -1 ? '| | +-' :
			context.indexOf('argument') > -1 ? '| | | +-' : ''
		) + context;
	};

	var pad = function (str, len) {
		str = String(str);
		return str.length >= len ? str : str + new Array(len - str.length + 1)
			.join(' ');
	};

	var getCommentBefore = function (data, start, clip) {
		var subdata = data.substring(0, start + 1),
			lines = subdata.split('\n')
				.reverse()
				.slice(clip ? 1 : 0); // HACK

		return getComment(lines)
			.reverse()
			.join('\n');
	};

	var getCommentAfter = function (data, start) {
		var subdata = data.substring(start - 1), // FIXME: not sure why -1
			lines = subdata.split('\n');
		return getComment(lines)
			.join('\n');
	};

	var getComment = function (lines) {
		var commentLines = [],
			i, l, line;
		for (i = 0, l = lines.length; i < l; i++) {
			line = lines[i].trim();
			if (line.length === 0 || line.indexOf('/*') === 0) {
				continue;
			}
			if (line.indexOf('///') !== 0) {
				break;
			}
			commentLines.push(line);
		}
		return commentLines;
	};

	// Gives each element a 'last' boolean property (useful for mustache templates)
	var muList = function (list) {
		_.each(list, function (item) {
			item.last = false;
		});
		list[list.length - 1].last = true;
		return list;
	};

	var lineNumber = function (data, charNumber) {
		return data.substring(0, charNumber)
			.split('\n')
			.length + 1;
	};

	module.exports = _.extend({
		Model: Model,
		Collection: Collection,
		log: log,
		muList: muList,
		lineNumber: lineNumber,
		getComment: getComment,
		getCommentAfter: getCommentAfter,
		getCommentBefore: getCommentBefore,
		tree: tree,
		parseMatch: parseMatch,
		markedOptions: markedOptions,
		setLogging: setLogging,
		summary: summary
	}, gu);
}());