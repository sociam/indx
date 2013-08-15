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
		clc = require('cli-color'),
		Backbone = require('backbone');

	mu.root = __dirname + '/template';


	var methodGrammar = new GrammarParser('./grammars/method-grammar'),
		fileGrammar = new GrammarParser('./grammars/file-grammar');


	var Model = Backbone.Model.extend({
			defaults: {
				name: '',
				description: ''
			},
			initialize: function () { this.parsed = new Promise(); },
			afterParsed: function (fn) { return this.parsed.then(fn); },
			object: function () { return this.toJSON(); }
		}),
		Collection = Backbone.Collection.extend({
			array: function () {
				return this.map(function (o) {
					return o.object();
				});
			},
			parseModels: function () {
				var that = this,
					promise = new Promise();
				if (that.length > 0) {
					this.each(function (file, i) {
						if (i > 0) {
							that.at(i - 1).afterParsed(function () { file.parse(); });
						} else {
							file.parse();
						}
					});
					this.last().afterParsed(function () { promise.resolve(); });
				} else {
					promise.resolve();
				}
				return promise;
			}
		});

	


	var Builder = Backbone.Model.extend({
		initialize: function () {
			var that = this;
			this.ready = new Promise();
			that.files = new Files();
			this.classes = new Classes(undefined, { builder: builder });

			this._buildFilePaths().then(function (filenames) {
				that.set('filenames', filenames);
				_.each(filenames, function (filename) {
					that.files.add({ filename: filename }, { builder: that });
				});
				that.ready.resolve();
			});
		},
		superClasses: function () {
			var Obj = new Class();
			Obj.regexps = [
				['([^\\s]*[\\.|\\s]+([A-Z][^\\s\\.]*)) *= *function *\\(([^\\)]*)\\)', function (match, fullName, name, n, pos) {
					return { match: match, name: name, fullName: fullName, start: pos };
				}],
				['function\\s*([A-Z][^\\s.]*) *\\(([^\\)]*)\\)', function (match, name, pos) {
					return { match: match, name: name, start: pos };
				}]
			];

			return [Obj].concat(this.classes.map(function (cls) {
				var Superclass = new Class({ name: cls.name });

				Superclass.regexps = [
					['([^\\s.]*) *= *' + (cls.get('fullName') || cls.get('name')) + '\\.extend\\(', function (match, name, pos) {
						return { match: match, name: name, start: pos, fullName: name };
					}]
				];
				return Superclass;
			}));
		},
		pushClasses: function (classes) {
			var that = this;
			classes.each(function (cls) { that.classes.add(cls); });
		},
		build: function () {
			var that = this;
			this.ready.then(function () {
				log('build', 'starting build process');
				that.files.parse().then(function () {
					that.render();
				});
			});
		},
		render: function () {
			var that = this,
				html = '',
				outputDir = this.get('outputDirectory');

			log('build', 'rendering to ' + outputDir);

			deleteFolderRecursive(outputDir);
			ncp('./template', outputDir, function (err) {
				if (err) { throw err; }
				mu.compileAndRender('index.mu', that.object()).on('data', function (dat) {
					html += dat.toString();
				}).on('end', function () {
					fs.writeFile(outputDir + '/index.html', html, function (err) {
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
				lastPromise = new Promise(),
				files = [];

			_.each(this.get('filePaths'), function (glob, i) {
				var promise = new Promise();
				lastPromise.then(function () {
					globp(that.get('basePath') + glob, { }, function (err, globFiles) {
						files = files.concat(globFiles);
						promise.resolve();
					});
				});
				if (i === 0) { lastPromise.resolve(); }
				lastPromise = promise;
			});

			lastPromise.then(function () {
				log('build', 'got ' + files.length + ' file paths');
				promise.resolve(files);
			});

			return promise;
		},
		object: function () {
			var o = _.extend(this.toJSON(), {
				files: this.files.array()
			});
			return _.extend({
				json: CJSON.stringify(o)
			}, o);
		}
	});

	var File = Model.extend({
		initialize: function (attributes, options) {
			Model.prototype.initialize.apply(this, arguments);
			this.builder = options.builder;
		},
		parse: function () {
			log('parse file', this.get('filename'));
			var that = this;
			fs.readFile(this.get('filename'), function (err, data) {
				log('read', that.get('filename'));
				if (err) { throw err; }
				that.data = data.toString();
				that.classes = new Classes(undefined, { builder: builder, file: this, data: that.data });
				that.parseComment().then(function () {
					that.classes.parse();
					builder.pushClasses(that.classes);
					that.parsed.resolve();
				});
			});
		},
		parseComment: function () {
			var that = this,
				comment = getCommentAfter(this.data, 0);
			return fileGrammar.parse(comment).then(function (rs) {
				rs.description = rs.description.join('<br>')
				console.log("P", rs)
				that.set(rs);
			});
		},
		object: function () {
			return _.extend(this.toJSON(), {
				classes: this.classes.array()
			});
		}
	});

	var Files = Collection.extend({
		model: File,
		parse: function () { return this.parseModels(); }
	});

	var Class = Model.extend({
		initialize: function (attributes, options) {
			Model.prototype.initialize.apply(this, arguments);
			this.data = options ? options.data : undefined;
			this.methods = new Methods(undefined, { cls: this, data: this.data });
		},
		parse: function () {
			log('parse class', this.get('name'));
			var that = this;

			//this.parseComment().then(function () {
				that.methods.parse();
				that.parsed.resolve();
			//});

		},
		/*parseComment: function () {
			var that = this,
				comment = getCommentAfter(this.data, 0);
			return classGrammar.parse(comment).then(function (rs) {
				rs.description = rs.description.join('<br>')
				console.log("P", rs)
				that.set(rs);
			});
		},*/
		object: function () {
			return _.extend(this.toJSON(), {
				methods: this.methods.array()
			});
		}
	});

	var Classes = Collection.extend({
		model: Class,
		initialize: function (models, options) {
			this.builder = options.builder;
			this.file = options.file;
			this.data = options.data
		},
		parse: function () {
			var that = this,
				superclasses = builder.superClasses();
			// Find each class that extends each superclass
			_.each(superclasses, function (superCls) {
				_.each(superCls.regexps, function (regexp) {
					var re = new RegExp(regexp[0], 'g');
					that.data.replace(re, function () {
						var match = regexp[1].apply(this, arguments);
						that.add(_.extend({
							super: superCls.cls,
							file: that.file
						}, match), { data: that.data });
					});

				});
			});

			// Infer that the end the each class is the start of the next
			that.each(function (cls, i) {
				if (i > 0) { that.at(i - 1).set('end', cls.get('start') - 1); }
			});
			// ... or the end of the file
			if (that.length > 0) { that.last().set('end', that.data.length - 1); }
			// Parse each class
			return this.parseModels();
		}
	});

	var Method = Model.extend({
		initialize: function (attributes, options) {
			Model.prototype.initialize.apply(this, arguments);
			this.data = options.data;
			this.arguments = new Arguments(undefined, { method: this, args: this.get('args') });
		},
		parse: function () {
			var that = this;
			this.parseComment().then(function () {
				if (that.arguments.length > 0) {
					that.set('hasArgs', true);
					that.arguments.parse();
					that.parsed.resolve();
				}
			});
		},
		parseComment: function () {
			var that = this,
				comment = getCommentBefore(this.data, this.get('start'))
			return methodGrammar.parse(comment).then(function (rs) {
				//console.log(JSON.stringify(rs, null, ' '))
				var oldArgs = that.get('args');
				that.set(rs);
				if (!that.get('args')) { that.set('args', oldArgs); }
			});
		},
		object: function () {
			return _.extend(this.toJSON(), {
				arguments: this.arguments.array()
			});
		}
	})

	var Methods = Collection.extend({
		model: Method,
		initialize: function (models, options) {
			this.cls = options.cls;
			this.data = options.data;
		},
		parse: function () {
			var that = this,
				start = this.cls.get('start'),
				end = this.cls.get('end'),
				data = this.data,
				subdata = data.substring(start, end),
				methods = [];

			var re = new RegExp('[\\.|\\s]+([a-z_][^\\s.]*) *[:=] *function *\\(([^\\)]*)\\)', 'g');

			subdata.replace(re, function (match, name, args, pos) {
				if (name.indexOf('_') === 0) { return; }
				var method = {
						name: name,
						start: start + pos,
						args: args,
						line: lineNumber(data, start + pos)
					};

				that.add(method, { data: that.data });

				return match;
			});

			return this.parseModels();
		}
	});

	var Argument = Model.extend({
		initialize: function () {
			Model.prototype.initialize.apply(this, arguments);
			this.args = options.args;
		},
		parse: function () {
			return _.chain(this.args.split(',')).map(function (arg) {
				return { name: arg.trim() };
			}).reject(function (o) {
				return o.name.length === 0;
			}).value();

			this.each(function (arg) {
				arg.set('moreInfo', !!arg.types || !!arg.comment);
				arg.set('last', false);
				if (arg.get('types') && arg.get('types').length > 0) {
					arg.set('hasTypes', true);
					_.each(arg.get('types'), function (type) {
						type.last = false;
					});
					arg.get('types')[arg.types.length - 1].last = true;
				}
			});
			this.last().set('last', true);

			this.parsed.resolve();
		}
	})

	var Arguments = Collection.extend({
		model: Argument,
		initialize: function (models, options) {
		},
		parse: function () {
			return this.parseModels();
		}
	});

	
	function log (context, message) {
		console.log(' ' + clc.green(context) + ' ' + message);
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
			if (line.length === 0 || line.indexOf('/*') === 0) { continue; }
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


	var builder = new Builder(config);
	builder.build();

}());
