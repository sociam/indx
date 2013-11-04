/* jshint node:true */
(function () {

	'use strict';

	var clc = require('cli-color'),
		fs = require('fs'),
		_ = require('underscore'),
		mu = require('mustache'),
		GrammarParser = require('./lib/grammar-parser.js'),
		Q = require('q'),
		CJSON = require('circular-json'),
		ncp = require('ncp'),
		globp = require('glob'),
		Backbone = require('backbone'),
		marked = require('marked'),
		optimist = require('optimist'),
		path = require('path'),
		u = require('../utils.js');

	var argv = optimist.argv,
		logging = false,
		config;

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

	optimist
		.usage('Usage: $0 [config file]')
		.alias('l', 'log-stdout')
		.alias('h', 'help')
		.alias('o', 'output-directory')
		.alias('t', 'template')
		.describe('l', 'Output logs to stdout')
		.describe('h', 'Display help')
		.describe('o', 'Where to create documentation')
		.describe('t', 'Which template to use');

	if (argv.h || argv.help) {
		optimist.showHelp();
		process.exit(0);
	}

	if (argv.l || argv['log-stdout']) {
		logging = true;
	}

	if (!argv._.length) {
		optimist.showHelp();
		process.exit(1);
	} else {
		log('loading config ' + argv._[0]);
		config = require(u.relativeToCwd(argv._[0]));
	}

	if (argv.o || argv['output-directory']) {
		config.outputDirectory = u.relativeToCwd(argv.o || argv['output-directory']);
	}

	if (argv.t || argv.template) {
		config.template = argv.o || argv.template;
	}

	config.basePath = u.relativeTo(config.basePath, path.dirname(u.relativeToCwd(argv._[0])));

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


	var templateRoot = __dirname + '/template/' + (config.template || 'clean') + '/',
		templateCache = {};

	mu.root = templateRoot;

	var cacheTemplates = function (path) {
		path = path || '';
		var deferred = Q.defer();
		fs.readdir(templateRoot + path, function (err, files) {
			if (err) {
				throw err;
			}
			var promises = [];
			_.each(files, function (file) {
				var filename = path + file;
				if (fs.lstatSync(templateRoot + filename)
					.isDirectory()) {
					promises.push(cacheTemplates(filename + '/'));
				} else if (file.indexOf('.mu', file.length - 3) > -1) { // ends with .mu
					var deferred = Q.defer();
					log('caching mustache', filename);
					fs.readFile(templateRoot + filename, function (err, data) {
						if (err) {
							throw err;
						}
						templateCache[filename] = data.toString();
						deferred.resolve();
					});
					promises.push(deferred.promise);
				}
			});
			Q.all(promises)
				.then(function () {
					deferred.resolve();
				});
		});
		return deferred.promise;
	};

	var methodGrammar = new GrammarParser(u.relativeTo('grammars/method-grammar.peg', __dirname)),
		fileGrammar = new GrammarParser(u.relativeTo('grammars/file-grammar.peg', __dirname)),
		classGrammar = new GrammarParser(u.relativeTo('grammars/class-grammar.peg', __dirname));


	// TODO: actually use these specs
	var fileTags = {
		'title': { validate: function (str) { return typeof str === 'string'; } },
		'version': {},
		'author': { repeatable: true },
		'since': {},
		'see': { repeatable: true }
	};

	var classTags = {
		'class': { empty: true },
		'ignore': { empty: true },
		'extend': { repeatable: true, aliases: ['extends', 'augments'], process: function () {} },
		'name': {},
		'fullName': {},
		'order': {},
		'since': {},
		'see': { repeatable: true },
		'deprecated': {},
		'alias': { repeatable: true }
	};

	var attributeTags = {
		'attribute': { empty: true },
		'name': {},
		'optional': {},
		'types': {},
		'ignore': { empty: true },
		'order': {},
		'since': {},
		'see': { repeatable: true },
		'deprecated': {},
		'alias': { repeatable: true },
		'default': {}
	};

	var methodTags = {
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
		'throws': { repeatable: true, aliases: ['exception'] },
		'since': {},
		'see': { repeatable: true },
		'deprecated': {},
		'private': { empty: true, groupwith: ['public', 'protected', 'access'] },
		'public': { empty: true },
		'protected': { empty: true },
		'access': { },
		'alias': { repeatable: true }
	};


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

	var Builder = Backbone.Model.extend({
		initialize: function () {
			var that = this,
				deferred = Q.defer();
			this.ready = Q.defer();
			that.files = new Files();
			this.superclasses = new Classes([new ObjectClass()], {
				builder: builder
			});

			if (this.get('readme')) {
				fs.readFile(u.relativeTo(this.get('readme'), this.get('basePath')), function (err, content) {
					if (err) {
						throw err;
					}
					marked(content.toString(), markedOptions, function (err, html) {
						if (err) {
							throw err;
						}
						that.set('readmeDescription', html);
					});
					deferred.resolve();
				});
			} else {
				deferred.resolve();
			}

			deferred.promise.then(function () {
				that._buildFilePaths()
					.then(function (files) {
						that.set('filenames', files);
						_.each(files, function (filenames, key) {
							_.each(filenames, function (filename) {
								that.files.add({
									filename: filename,
									supplementary: key === 'require'
								}, {
									builder: that
								});
							});
						});
						that.ready.resolve();
					});
			});
		},
		build: function () {
			var that = this;
			this.ready.promise.then(function () {
				log('build', 'starting build process');
				that.files.parse()
					.then(function () {
						that.render();
					});
			});
		},
		render: function () {
			var that = this,
				html = '',
				outputDir = u.relativeTo(this.get('outputDirectory'), that.get('basePath'));

			log('build', 'rendering to ' + outputDir);

			u.rmdirRecursive(outputDir);
			u.mkdirRecursive(outputDir);
			ncp(templateRoot, outputDir, function (err) {
				if (err) {
					throw err;
				}
				html = mu.render(templateCache['index.mu'], that.object(), templateCache);

				fs.writeFile(outputDir + '/index.html', html, function (err) {
					if (err) {
						throw err;
					}
					log('Successfully built documentation in ' + outputDir, true);
				});
			});
		},
		// Expands globs into paths
		_buildFilePaths: function () {
			log('build', 'building file paths');
			var that = this,
				deferred = Q.defer(),
				promises = [],
				fileLists = {};

			_.each(['require', 'files'], function (key) {
				var list = that.get(key),
					lastDeferred = Q.defer();
				fileLists[key] = [];
				_.each(list, function (globPart, i) {
					var deferred = Q.defer(),
						glob = u.relativeTo(globPart, that.get('basePath'));
					lastDeferred.promise.then(function () {
						globp(glob, {}, function (err, globFiles) {
							if (globFiles.length === 0) {
								log('warning', glob + ' did not match any files');
							}
							fileLists[key] = fileLists[key].concat(globFiles);
							deferred.resolve();
						});
					});
					if (i === 0) {
						lastDeferred.resolve();
					}
					lastDeferred = deferred;
				});
				promises.push(lastDeferred.promise);
			});

			Q.all(promises)
				.then(function () {
					log('build', 'got ' + (fileLists.require.length + fileLists.files.length) +
						' file paths');
					deferred.resolve(fileLists);
				});

			return deferred.promise;
		},
		object: function () {
			var o = _.extend(this.toJSON(), {
				files: this.files.array()
			});
			_.each(o.files, function (file) {
				_.each(file.classes, function (cls) {
					cls.file = file;
					_.each(cls.methods, function (method) {
						method['class'] = cls;
					});
				});
			});
			return _.extend({
				json: CJSON.stringify(o)
			}, o);
		}
	});

	var File = Model.extend({
		tags: fileTags,
		initialize: function (attributes, options) {
			Model.prototype.initialize.apply(this, arguments);
			this.builder = options.builder;
		},
		parse: function () {
			var that = this;
			log('READ FILE', this.get('filename'));
			fs.readFile(this.get('filename'), function (err, data) {
				log('PARSE FILE', that.get('filename'));
				if (err) {
					throw err;
				}
				that.data = data.toString();
				that.classes = new Classes(undefined, {
					builder: builder,
					file: that,
					data: that.data
				});
				that.parseComment()
					.then(function () {
						that.classes.parse(builder)
							.then(function () {
								that.parsed.resolve();
							});
					});
			});
		},
		parseComment: function () {
			var that = this,
				comment = getCommentAfter(this.data, 0),
				deferred = Q.defer();
			fileGrammar.parse(comment)
				.then(function (rs) {
					if (!rs.title) {
						rs.title = that.get('filename').split('/').pop();
					}
					parseMatch(rs, that)
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

	var Files = Collection.extend({
		model: File,
		parse: function () {
			return this.parseModels();
		}
	});

	var Class = Model.extend({
		tags: classTags,
		defaults: {
			extend: false
		},
		initialize: function (attributes, options) {
			this.data = options ? options.data : undefined;
			this.file = options ? options.file : undefined;
			Model.prototype.initialize.apply(this, arguments);
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
			log('parse class', this.get('name'));
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
				comment = getCommentBefore(this.data, this.get('start'), true),
				deferred = Q.defer();
			classGrammar.parse(comment)
				.then(function (rs) {
					parseMatch(rs, that)
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

	var parseMatch = function (rs, model) {
		var deferred = Q.defer();

		log('Comment parsed for method ' + model.get('name'), rs.properties)
		
		// Validate properties from description
		var tags = model.tags,
			properties = _.clone(rs.properties);
		_.each(properties, function (values, tag) {
			var tagValidation = tags[tag];
			if (!tagValidation) {
				delete properties[tag];
				console.warn(tag + ' is not a recognised tag.');
				return;
			}
			if (tag.empty && values) {
				console.warn(tag + ' should be empty, contains ' + values)
			}
			if (!tag.repeatable) {
				if (values.length > 1) {
					console.warn(tag + ' is not repeatable (found ' + values.length + ' matches. Taking first element only.');
				}
				properties[arg] = _(values).first();
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

	var Classes = Collection.extend({
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
				log('CHECKING FOR INHERITANCE ON', superCls.get('name'));
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
							log('Found already', match.fullName)
							return;
						}
						log(match.fullName, superCls.get('name'));
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

	var Method = Model.extend({
		tags: methodTags,
		initialize: function (attributes, options) {
			this.data = options.data;
			this.cls = options.cls;
			Model.prototype.initialize.apply(this, arguments);
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
			this.arguments = new Arguments(args, {
				method: this
			});
			log('new method', this.cls.get('name') + '.' + this.get('name'));
		},
		parse: function () {
			log('parse method', this.cls.get('name') + '.' + this.get('name'));

			var that = this;
			this.parseComment()
				.then(function () {

					that.arguments.parse()
						.then(function () {
							if (that.arguments.length > 0) {
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
									muList(arg.type);
								});
							});
							that.get('result')[resultType] = {
								then: muList(_.where(arr, { type: 'then' })),
								fail: muList(_.where(arr, { type: 'fail' }))
							};
						} else {
							that.get('result')[resultType] = arr;
						}
						that.unset('result_' + resultType);
						_.each(that.get('result')['return'], function (r) {
							if (r.types) {
								muList(r.types);
								r.hasTypes = true;
							}
						});
					}
				});
		},
		parseComment: function () {
			var that = this,
				deferred = Q.defer(),
				comment = getCommentBefore(this.data, this.get('start'), true);

			methodGrammar.parse(comment)
				.then(function (rs) {
					parseMatch(rs, that)
						.then(function () {
							if (that.get('args')) {
								that.arguments.reset(that.get('args'));
							}
							that.unset('args');
							deferred.resolve();
						});
				});

			return deferred.promise;
		},
		object: function () {
			if (this.arguments.last()) {
				this.arguments.last()
					.set('last', true);
			}
			return _.extend(this.toJSON(), {
				args: this.arguments.array()
			});
		},
		uid: function () {
			return this.cls.id + '_method-' + this.get('name')
				.replace(/\W+/gi, '');
		}
	});

	var Methods = Collection.extend({
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
					line: lineNumber(data, start + pos)
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

	var Argument = Model.extend({
		initialize: function (attributes, options) {
			this.args = options.args;
			this.method = this.collection.method;
			Model.prototype.initialize.apply(this, arguments);
		},
		parse: function () {
			log('parse argument', this.get('name'));

			this.set('moreInfo', !! this.get('types') || !! this.get('comment'));
			var types = this.get('types');
			if (types && types.length > 0) {
				this.set('hasTypes', true);
				muList(types);
			}

			this.parsed.resolve();
		},
		uid: function () {
			return this.method.id + '_argument-' + this.get('name')
				.replace(/\W+/gi, '');
		}
	});

	var Arguments = Collection.extend({
		model: Argument,
		initialize: function (models, options) {
			this.method = options.method;
		},
		parse: function () {
			return this.parseModels();
		}
	});



	function tree(context) {
		return (
			context.indexOf('file') > -1 ? '+-' :
			context.indexOf('class') > -1 ? '| +-' :
			context.indexOf('method') > -1 ? '| | +-' :
			context.indexOf('argument') > -1 ? '| | | +-' : ''
		) + context;
	}

	function pad(str, len) {
		str = String(str);
		return str.length >= len ? str : str + new Array(len - str.length + 1)
			.join(' ');
	}

	function getCommentBefore(data, start, clip) {
		var subdata = data.substring(0, start + 1),
			lines = subdata.split('\n')
				.reverse()
				.slice(clip ? 1 : 0); // HACK

		return getComment(lines)
			.reverse()
			.join('\n');
	}

	function getCommentAfter(data, start) {
		var subdata = data.substring(start - 1), // FIXME: not sure why -1
			lines = subdata.split('\n');
		return getComment(lines)
			.join('\n');
	}

	function getComment(lines) {
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
	}
	// Gives each element a 'last' boolean property (useful for mustache templates)

	function muList(list) {
		_.each(list, function (item) {
			item.last = false;
		});
		list[list.length - 1].last = true;
		return list;
	}



	function lineNumber(data, charNumber) {
		return data.substring(0, charNumber)
			.split('\n')
			.length + 1;
	}

	var builder = new Builder(config);

	cacheTemplates()
		.then(function () {
			builder.build();
		});

}());