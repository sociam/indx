
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mu2'),
		config = require('./config.js'),
		GrammarParser = require('./grammar-parser.js'),
		allPromises = require('node-promise').all,
		Promise = require('node-promise').Promise;

	mu.root = __dirname + '/templates';

	fs.readFile(config.basePath + config.files[0], function (err, data) {
		if (err) { throw err; }

		var appData = _.extend({}, config),
			app = _.extend({ /*json: JSON.stringify(appData)*/ }, appData),
			html = '';

		parseClasses(data.toString()).then(function (classes) {
			_.extend(app, { classes: classes });

			mu.compileAndRender('index.html', app).on('data', function (dat) {
				html += dat.toString();
			}).on('end', function () {
				fs.writeFile('./build/index.html', html, function (err) {
					if (err) { throw err; }
				});
			});
		});

	});

	var Class = function (attributes, extend) {
		this.methods = [];
		this.properties = [];

		this.set(attributes);

		if (extend) {
			this.extend = extend;
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

			var oldMethods = cls.methods


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
		},
	});


	function generateSuperClasses () {
		return _.extend({
			'Object' : new Class({
				regexps: [
					['([A-Z][^\\\s.]*) *= *function *\\\(([^\\\)]*)\\\)', function (match, name, pos) {
						return { match: match, name: name, start: pos };
					}],
					['function *([A-Z][^\\\s.]*) *\\\(([^\\\)]*)\\\)', function (match, name, pos) {
						return { match: match, name: name, start: pos };
					}]
				]
			})
		}, _.map(config.superclasses, function (cls, name) {
			var ncls = _.extend({
				name: name,
				regexps: [
					['([^\\\s.]*) *= *' + name + '\\\.extend\\\(', function (match, name, pos) {
						return { match: match, name: name, start: pos };
					}]
				]
			}, cls);
			return new Class(ncls);
		}));
	}

	function parseClasses (data) {

		var classes = [],
			dfds = [],
			superclasses = generateSuperClasses(),
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

		var re = new RegExp('([^\\\s]*) *: *function *\\\(([^\\\)]*)\\\)', 'g');

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
			methods = _.sortBy(methods, function (method) { return method.lineNoStart; });

			promise.resolve(methods);
		});

		return promise;

	}

	function parseArgs (data) {
		var args = _.map(data.split(','), function (arg) {
			return {
				name: arg.trim()
			};
		});
		args[args.length - 1].last = true;
		return args;
	}

	var methodGrammar = new GrammarParser('./grammar');

	function parseMethodComment (comment, method) {

		return methodGrammar.parse(comment).then(function (rs) {
			//console.log(rs);
			_.extend(method, rs);

			console.log(JSON.stringify(rs, null, ' '))
			//console.log(method)
		});
		/*var lines = comment.split('\n'),
			oldArgs = method.args,
			mode = 0; // arguments, description, result
		method.args = [];
		_.each(lines, function (line) {
			line = line.trim();
			if (line.indexOf('@arg') === 0) {
				method.args.push(parseArgComment(line));
			}
		});
		if (method.args.length === 0) {
			method.args = oldArgs;
			console.log(method.args)
		} else {
			method.args[method.args.length - 1].last = true;
		}*/
	}

	function parseArgComment (str) {
		var parts = genericParser(str.trim().substring(4).trim(), ['<type>?', '<name>', ':?', '<comment>']);
		return parts;
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


	function genericParser (str, parts) {
		var regexps = {
				type: '<([^>]+)>',
				name: '(\\\w+)',
				comment: '(.*)'
			},
			currPos = 0,
			result = {};

		_.each(parts, function (part) {
			var l = part.length,
				optional, p, regexp;

			if (part.indexOf('?') === l - 1) {
				optional = true; // TODO
				part = part.substr(0, part.length - 1);
			}

			if (part.indexOf('<') === 0) {
				p = part.substring(1, part.indexOf('>'));
				regexp = new RegExp(regexps[p]);
			} else {
				p = part;
				regexp = new RegExp(part);
			}

			str.substring(currPos).replace(regexp, function (match) {
				var pos = _.find(arguments, function (a) { return _.isNumber(a); });
				currPos = currPos + pos + match.length;
				result[p] = match.trim();
			});
		});

		return result;
		/*_.each(regexps, function (r, k) {
			regexp.replace('<' + k + '>', r);
		});
		return new RegExp(regexp, flags);*/
	}

}());
