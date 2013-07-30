/* jshint node:true */
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mu2'),
		config = require('./config.js'),
		GrammarParser = require('./lib/grammar-parser.js'),
		allPromises = require('node-promise').all,
		Promise = require('node-promise').Promise,
		CJSON = require('circular-json'),
		ncp = require('ncp'),
		globp = require('glob'),
		clc = require('cli-color');

	mu.root = __dirname + '/template';


	var methodGrammar = new GrammarParser('./grammars/method-grammar'),
		fileGrammar = new GrammarParser('./grammars/file-grammar');

	function log (context, message) {
		console.log(' ' + clc.green(context) + ' ' + message);
	}

	var Builder = function (config) {
		this.config = config;
		this.app = _.extend({ files: [], classes: [] }, this.config);
	};

	_.extend(Builder.prototype, {
		build: function () {
			log('build', 'starting build process');
			var that = this,
				files = this.app.files;
			this._buildFilePaths().then(function (filenames) {
				_.each(filenames, function (filename, i) {
					var file = new File(filename, that.app);
					files.push(file);
					if (files[i - 1]) {
						files[i - 1].then(function () { file.parse(); });
					} else {
						file.parse();
					}
				});
				files[files.length - 1].then(function () {
					that.render();
				});
			});
		},
		render: function () {
			_.extend(this.app, { json: CJSON.stringify(this.app) }); // So we have a js representation on client
			var that = this,
				html = '';

			deleteFolderRecursive('./build');
			ncp('./template', './build', function (err) {
				if (err) { throw err; }
				mu.compileAndRender('index.mu', that.app).on('data', function (dat) {
					html += dat.toString();
				}).on('end', function () {
					fs.writeFile('./build/index.html', html, function (err) {
						if (err) { throw err; }
					});
				});
			});
		},
		// Expands globs into paths
		_buildFilePaths: function () {
			log('build', 'building file paths');
			var that = this,
				promise = new Promise(),
				globPromises = [],
				files = [];

			_.each(this.config.filePaths, function (glob) {
				var globPromise = new Promise();
				globPromises.push(globPromise);
				globp(that.config.basePath + glob, { }, function (err, globFiles) {
					files = files.concat(globFiles);
					globPromise.resolve();
				});
			});

			allPromises(globPromises).then(function () {
				log('build', 'got ' + files.length + ' file paths');
				promise.resolve(files);
			});

			return promise;
		}
	});

	var builder = new Builder(config);
	builder.build();

	function File (file, app) {
		this.promise = new Promise();
		this.then = this.promise.then;
		this.fail = this.promise.fail;
		this.app = app;
		this.file = file;
		this.classes = [];
	}

	_.extend(File.prototype, {
		parse: function () {
			log('parse file', this.file);
			var that = this;
			fs.readFile(this.file, function (err, data) {
				log('read', that.file);
				if (err) { throw err; }
				that.data = data.toString();
				that.parseComment().then(function () {
					that.parseClasses();
				});
			});
		},
		parseComment: function () {
			var that = this,
				comment = getCommentAfter(this.data, 0);
			return fileGrammar.parse(comment).then(function (rs) {
				//console.log(JSON.stringify(rs, null, ' '))
				_.extend(that, rs);
			});
		},
		parseClasses: function () {
			var that = this,
				classes = this.classes,
				superclasses = generateSuperClasses(this.app.classes),
				promises = [];
			// Find each class that extends each superclass
			_.each(superclasses, function (superCls) {
				_.each(superCls.regexps, function (regexp) {
					var re = new RegExp(regexp[0], 'g');
					that.data.replace(re, function () {
						var match = regexp[1].apply(this, arguments);
						console.log(match);
						var cls = new Class(that.data, match, superCls.cls, that);
						that.app.classes.push(cls);
						classes.push(cls);
					});

				});
			});

			// Sort each class by its line number
			classes = _.sortBy(classes, function (cls) { return cls.start; });
			// Infer that the end the each class is the start of the next
			_.each(classes, function (cls, i) {
				if (i > 0) { classes[i - 1].end = cls.start - 1; }
			});
			// ... or the end of the file
			if (classes.length > 0) { classes[classes.length - 1].end = that.data.length - 1; }
			// Parse each class
			_.each(classes, function (cls) { promises.push(cls.parse()); });

			allPromises(promises).then(function () {
				that.promise.resolve();
			});
		},
		uid: function () {
			return 'file-' + this.file.replace(/\W+/gi, '-');
		}
	});

	var Class = function (data, attributes, extend, file) {
		this.data = data;
		this.methods = [];
		this.properties = [];
		this.file = file;

		this.set(attributes);

		if (extend) {
			this.extend = extend;
			//this.methods = _.map(extend.methods, function (method) {
				//console.log(method.name)
			//	return _.extend({}, method);
			//});
			// inherit properties
		}
		_.bindAll(this, 'uid', 'instanceName');
	};

	_.extend(Class.prototype, {
		fullName: function () { return this.name; },
		set: function (attributes) {
			_.extend(this, attributes);
		},
		uid: function () {
			return _.result(this.file, 'uid') + '_class-' + this.name.replace(/\W+/gi, '');
		},
		instanceName: function () {
			return this.name.charAt(0).toLowerCase() + this.name.substr(1);
		},
		parse: function () {
			log('parse class', this.name);
			var that = this,
				promise = new Promise();

			parseMethods(this.data, this.start, this.end, this).then(function (methods) {
				_.each(methods, function (method) {
					var existing = _.findWhere(that.methods, { name: method.name }); // TODO
					that.methods.push(new Method(method, that));
				});
				promise.resolve(methods);
			});

			return promise;
		}
	});

	var Method = function (attributes, cls) {
		_.extend(this, attributes);
		this.cls = cls;
		_.bindAll(this, 'uid');
	};

	_.extend(Method.prototype, {
		set: function (attributes) {
			_.extend(this, attributes);
		},
		uid: function () {
			return _.result(this.cls, 'uid') + '_method-' + this.name.replace(/\W+/gi, '-');
		}
	});


	function generateSuperClasses (classes) {
		return _.extend({
			'Object' : new Class('', {
				regexps: [
					['([^\\s]*[\\.|\\s]+([A-Z][^\\s\\.]*)) *= *function *\\(([^\\)]*)\\)', function (match, fullName, name, n, pos) {
						return { match: match, name: name, fullName: fullName, start: pos };
					}],
					['function\\s*([A-Z][^\\s.]*) *\\(([^\\)]*)\\)', function (match, name, pos) {
						return { match: match, name: name, start: pos };
					}]
				]
			})
		}, _.map(classes, function (cls) {
			var ncls = _.extend({
				name: cls.name,
				regexps: [
					['([^\\s.]*) *= *' + (cls.fullName || cls.name) + '\\.extend\\(', function (match, name, pos) {
						console.log(name);
						return { match: match, name: name, start: pos };
					}]
				],
				cls: cls
			});
			return new Class('', ncls);
		}));
	}

	function parseMethods (data, start, end, cls) {
		var promise = new Promise(),
			dfds = [],
			subdata = data.substring(start, end),
			methods = [];

		var re = new RegExp('[\\.|\\s]+([a-z_][^\\s.]*) *[:=] *function *\\(([^\\)]*)\\)', 'g');

		subdata.replace(re, function (match, name, args, pos) {
			if (name.indexOf('_') === 0) { return; }
			var method = {
					name: name,
					args: parseArgs(args),
					start: start + pos,
					line: lineNumber(data, start + pos)
				},
				comments = getCommentBefore(data, start + pos);


			dfds.push(parseMethodComment(comments, method));

			methods.push(method);

			return match;
		});


		allPromises(dfds).then(function () {
			methods = _.chain(methods).map(function (method) {

				if (method.args.length > 0) {
					method.hasArgs = true;

					_.each(method.args, function (arg) {
						arg.moreInfo = !!arg.types || !!arg.comment;
						arg.last = false;
						if (arg.types && arg.types.length > 0) {
							arg.hasTypes = true;
							_.each(arg.types, function (type) {
								type.last = false;
							});
							arg.types[arg.types.length - 1].last = true;
						}
					});
					method.args[method.args.length - 1].last = true;
				}
				//console.log(JSON.stringify(method, null, ' '))
				return method;
			}).sortBy(methods, function (method) {
				return method.start;
			}).value();

			promise.resolve(methods);
		});

		return promise;

	}

	function parseArgs (data) {
		return _.chain(data.split(',')).map(function (arg) {
			return { name: arg.trim() };
		}).reject(function (o) {
			return o.name.length === 0;
		}).value();
	}


	function parseMethodComment (comment, method) {

		return methodGrammar.parse(comment).then(function (rs) {
			//console.log(JSON.stringify(rs, null, ' '))
			var oldArgs = method.args;
			_.extend(method, rs);
			if (!method.args) { method.args = oldArgs; }
		});
	}


	function getCommentBefore (data, start) {
		var subdata = data.substring(0, start),
			lines = subdata.split('\n').reverse();
		return getComment(lines).reverse().join('\n');
	}

	function getCommentAfter (data, start) {
		var subdata = data.substring(start - 1), // FIXME: not sure why -1
			lines = subdata.split('\n');
		return getComment(lines).join('\n');
	}

	function getComment (lines) {
		var commentLines = [],
			i, l, line;
		for (i = 1, l = lines.length; i < l; i++) {
			line = lines[i].trim();
			if (line.indexOf('///') !== 0) { break; }
			commentLines.push(line);
		}
		return commentLines;
	}

	function deleteFolderRecursive (path) {
		var files = [];
		if( fs.existsSync(path) ) {
			files = fs.readdirSync(path);
			files.forEach(function(file,index){
				var curPath = path + "/" + file;
				if(fs.statSync(curPath).isDirectory()) { // recurse
					deleteFolderRecursive(curPath);
				} else { // delete file
					fs.unlinkSync(curPath);
				}
			});
			fs.rmdirSync(path);
		}
	}

	function lineNumber (data, charNumber) {
		return data.substring(0, charNumber).split('\n').length + 1;
	}

}());
