
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mu2'),
		config = require('./config.js'),
		GrammarParser = require('./grammar-parser.js'),
		allPromises = require('node-promise').all,
		Promise = require('node-promise').Promise,
		CJSON = require('circular-json');

	mu.root = __dirname + '/templates';

	var filesParsed = [],
		app = _.extend({ classes: [] }, config);

	_.each(config.files, function (file, i) {
		var promise = new Promise(),
			parse = function () {
				fs.readFile(config.basePath + file, function (err, data) {
					if (err) { throw err; }

					parseClasses(data.toString(), app).then(function () {
						promise.resolve();
					});

				});
			};

		filesParsed.push(promise);

		if (i > 0) {
			filesParsed[i - 1].then(function () { parse(); });
		} else {
			parse();
		}
	});

	allPromises(filesParsed).then(function () {
		var html = '';
		_.extend(app, { json: CJSON.stringify(app) });
		fs.writeFile('abstract.json', CJSON.stringify(app, null, ' '));
		mu.compileAndRender('index.html', app).on('data', function (dat) {
			html += dat.toString();
		}).on('end', function () {
			fs.writeFile('./build/index.html', html, function (err) {
				if (err) { throw err; }
			});
		});
	});

	var Class = function (attributes, extend) {
		this.methods = [];
		this.properties = [];

		this.set(attributes);

		if (extend) {
			//this.extend = extend;
			//console.log(extend)
			//_.defaults(this.attributes, this.extend.attributes);
			this.methods = _.map(extend.methods, function (method) {
				//console.log(method.name)
				return _.extend({}, method);
			});
			// inherit properties
		}
		_.bindAll(this, "uid", "instanceName");
	};

	_.extend(Class.prototype, {
		set: function (attributes) {
			_.extend(this, attributes);
		},
		uid: function () {
			return this.name.replace(/\W/gi, '');
		},
		instanceName: function () {
			return this.name.charAt(0).toLowerCase() + this.name.substr(1);
		},
		parse: function (data) {
			var that = this,
				promise = new Promise();

			parseMethods(data, this.start, this.end, this).then(function (methods) {
				_.each(methods, function (method) {
					var existing = _.findWhere(that.methods, { name: method.name }); // TODO
					that.methods.push(new Method(method, that));
				});
				promise.resolve(methods);
			});

			return promise;

			var oldMethods = cls.methods;


			cls.methods = methods;

			_.each(oldMethods, function (method) {
				var newMethod = _.findWhere(cls.methods, { name: method.name });
				if (!newMethod) {
					newMethod = _.clone(method);
					//cls.methods.push(newMethod); // PUT THIS BACK
				}
				newMethod.inheritedFrom = method;
			});
			return cls;
		}
	});

	var Method = function (attributes, cls) {
		_.extend(this, attributes);
		this.cls = cls;
		_.bindAll(this, "uid");
	};

	_.extend(Method.prototype, {
		set: function (attributes) {
			_.extend(this, attributes);
		},
		uid: function () {
			return this.cls.uid + '-' + this.name.replace(/\W/gi, '');
		}
	});


	function generateSuperClasses (classes) {
		return _.extend({
			'Object' : new Class({
				regexps: [
					['([^\\s]*[\\.|\\s]+([A-Z][^\\s\\.]*)) *= *function *\\(([^\\)]*)\\)', function (match, fullName, name, n, pos) {
						//console.log(arguments);
						return { match: match, name: name, fullName: fullName, start: pos };
					}],
					['function\\s*([A-Z][^\\s.]*) *\\(([^\\)]*)\\)', function (match, name, pos) {
						//console.log(arguments)
						return { match: match, name: name, start: pos };
					}]
				]
			})
		}, _.map(classes, function (cls) {
			var ncls = _.extend({
				name: cls.name,
				regexps: [
					['([^\\s.]*) *= *' + (cls.fullName || cls.name) + '\\.extend\\(', function (match, name, pos) {
						return { match: match, name: cls.name, start: pos };
					}]
				]
			}, cls);
			return new Class(ncls);
		}));
	}

	function parseClasses (data, app) {

		var classes = app.classes,
			dfds = [],
			superclasses = generateSuperClasses(classes),
			promise = new Promise();

		_.each(superclasses, function (scls) { // Find each class that extends each superclass
			_.each(scls.regexps, function (regexp) {
				var re = new RegExp(regexp[0], 'g');
				data.replace(re, function (_match) {
					var match = regexp[1].apply(this, arguments);
					classes.push(new Class(match, scls));
					return _match;
				});
			});

		});

		classes = _.sortBy(classes, function (cls) { return cls.start; });

		_.each(classes, function (cls, i) {
			if (i > 0) { classes[i - 1].end = cls.start - 1; }
		});
		if (classes.length > 0) { classes[classes.length - 1].end = data.length - 1; }

		_.each(classes, function (cls) {
			dfds.push(cls.parse(data));
		});

		allPromises(dfds).then(function () {
			promise.resolve(classes);
		});

		return promise;
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
					lineNoStart: pos
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
				return method.lineNoStart;
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

	var methodGrammar = new GrammarParser('./grammar');

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
			lines = subdata.split('\n').reverse(),
			commentLines = [],
			i, l, line;

		for (i = 1, l = lines.length; i < l; i++) {
			line = lines[i].trim();
			if (line.indexOf('///') !== 0) { break; }
			//line = line.substr(4).trim();
			commentLines.push(line);
		}
		return commentLines.reverse().join('\n');
	}


}());
