/* jshint node:true */
(function () {

	'use strict';
	
	var _ = require('underscore'),
		GrammarParser = require('./grammar-parser.js'),
		Q = require('q'),
		u = require('./utils.js'),
		Arguments = require('./arguments.js');

	var Method = u.Model.extend({
		grammar: new GrammarParser(u.relativeTo('../grammars/method-grammar.peg', __dirname)),
		tags: {
			'method': { empty: true },
			'arg': { repeatable: true, groupwith: ['opt'] },
			'opt': { repeatable: true },
			'return': { repeatable: true },
			'then': { repeatable: true, groupwith: ['fail'] },
			'fail': { repeatable: true },
			'chain': { empty: true },
			'name': {},
			'ignore': { empty: true },
			'order': {},
			'construct': { empty: true },
			'throws': { repeatable: true, aliases: ['exception'] },
			'since': {},
			'see': { repeatable: true },
			'deprecated': {},
			'private': { empty: true, groupwith: ['public', 'protected', 'access'] },
			'public': { empty: true },
			'protected': { empty: true },
			'access': { },
			'alias': { repeatable: true }
		},
		initialize: function (attributes, options) {
			this.data = options.data;
			this.cls = options.cls;
			u.Model.prototype.initialize.apply(this, arguments);
			var args = _.chain(this.get('args')
				.split(','))
				.map(function (arg) {
					return {
						name: arg.trim()
					};
				})
				.reject(function (o) {
					return o.name.length === 0;
				})
				.value();
			this.unset('args');
			this.args = new Arguments(args, {
				method: this
			});
			u.log('new method', this.cls.get('name') + '.' + this.get('name'));
		},
		parse: function () {
			u.log('parse method', this.cls.get('name') + '.' + this.get('name'));

			var that = this;
			this.parseComment()
				.then(function () {
					that.args.parse()
						.then(function () {
							if (that.args.length > 0) {
								that.set('hasArgs', true);
							}
							that.parsed.resolve();
						});

					var resultType =
						that.has('resultAsync') ? 'async' :
						that.has('resultChain') ? 'chain' :
						that.has('resultReturn') ? 'return' : undefined;

					if (resultType) {
						var arr = that.get('result_' + resultType);
						that.set('result', {});
						if (resultType === 'async') {
							_(arr).each(function (result) {
								_(result.args).each(function (arg) {
									u.muList(arg.type);
								});
							});
							that.get('result')[resultType] = {
								then: u.muList(_.where(arr, { type: 'then' })),
								fail: u.muList(_.where(arr, { type: 'fail' }))
							};
						} else {
							that.get('result')[resultType] = arr;
						}
						that.unset('result_' + resultType);
						_.each(that.get('result')['return'], function (r) {
							if (r.types) {
								u.muList(r.types);
								r.hasTypes = true;
							}
						});
					}
				});
		},
		parseComment: function () {
			var that = this,
				deferred = Q.defer(),
				comment = u.getCommentBefore(this.data, this.get('start'), true);

			this.grammar.parse(comment)
				.then(function (rs) {
					u.parseMatch(rs, that)
						.then(function () {
							if (that.get('args')) {
								that.args.reset(that.get('args'));
							}
							that.unset('args');
							deferred.resolve();
						});
				});

			return deferred.promise;
		},
		object: function () {
			if (this.args.last()) {
				this.args.last()
					.set('last', true);
			}
			return _.extend(this.toJSON(), {
				args: this.args.array()
			});
		},
		uid: function () {
			return this.cls.id + '_method-' + this.get('name')
				.replace(/\W+/gi, '');
		}
	});

	var Methods = u.Collection.extend({
		model: Method,
		initialize: function (models, options) {
			var that = this;
			this.cls = options.cls;
			this.data = options.data;
			this.on('change:order', function () {
				that.sort();
			});
		},
		parse: function () {
			var that = this,
				start = this.cls.get('start'),
				end = this.cls.get('end'),
				data = this.data,
				subdata = data.substring(start, end);

			var re = new RegExp(
				'[\\.|\\s]+([a-z_][^\\s.]*) *[:=] *function *\\(([^\\)]*)\\)', 'g');

			subdata.replace(re, function (match, name, args, pos) {
				if (name.indexOf('_') === 0) {
					return;
				}
				var method = {
					name: name,
					start: start + pos,
					args: args,
					line: u.lineNumber(data, start + pos)
				};

				that.add(method, {
					data: that.data,
					cls: that.cls
				});

				return match;
			});

			return this.parseModels();
		},
		comparator: function (m) {
			return m.has('order') ? Number(m.get('order')) : m.get('start');
		}
	});

	module.exports = Methods;
}());