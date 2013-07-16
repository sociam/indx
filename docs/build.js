
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mu2'),
		config = require('./config.js');

	mu.root = __dirname + '/templates';

	fs.readFile(config.basePath + config.files[0], function (err, data) {
		if (err) { throw err; }

		var appData = _.extend(parseClasses(data.toString()), config),
			app = _.extend({ json: JSON.stringify(appData) }, appData),
			html = '';

		process(app);

		mu.compileAndRender('index.html', app).on('data', function (dat) {
			html += dat.toString();
		}).on('end', function () {
			fs.writeFile('./build/index.html', html, function (err) {
				if (err) { throw err; }
			});
		});

	});


	function process (app) {
		_.each(app.classes, function (cls) {
			_.defaults(cls, {
				uid: cls.name.replace(/\W/gi, ''),
				instanceName: cls.name.charAt(0).toLowerCase() + cls.name.substr(1)
			});

			_.each(cls.methods, function (method) {

				_.defaults(method, {
					uid: cls.uid + '-' + method.name.replace(/\W/gi, '')
				});

			});

		});
	}


	function parseClasses (data) {

		var classes = [],
			superclasses = _.extend({
				'Object' : {
					regexps: [
						['([A-Z][^\\\s.]*) *= *function *\\\(([^\\\)]*)\\\)', function (match, name, pos) {
							return { match: match, name: name, start: pos };
						}],
						['function *([A-Z][^\\\s.]*) *\\\(([^\\\)]*)\\\)', function (match, name, pos) {
							return { match: match, name: name, start: pos };
						}]
					]
				}
			}, _.map(config.superclasses, function (cls, name) {
				return _.extend({
					name: name,
					regexps: [
						['([^\\\s.]*) *= *' + name + '\\\.extend\\\(', function (match, name, pos) {
							return { match: match, name: name, start: pos };
						}]
					]
				}, cls);
			}));

		_.each(superclasses, function (scls) {
			_.each(scls.regexps, function (regexp) {
				var re = new RegExp(regexp[0], 'g');
				data.replace(re, function () {
					var match = regexp[1].apply(this, arguments),
						cls = _.extend({
							extends: scls,
							methods: []
						}, scls, match);
					cls.methods = _.map(cls.methods, function (method) {
						return _.extend({
							class: scls
						}, method);
					});
					classes.push(cls);
					return this;
				});
			});
		});

		classes = _.sortBy(classes, function (cls) { return cls.start; });

		_.each(classes, function (cls, i) {
			if (i > 0) { classes[i - 1].end = cls.start - 1; }
		});

		if (classes.length > 0) { classes[classes.length - 1].end = classes[0].start - 1; }

		return {
			classes: _.map(classes, function (cls) {
				var subdata = data.substring(cls.start, cls.end),
					oldMethods = cls.methods,
					methods = parseMethods(subdata, cls.name).methods;

				cls.methods = methods;

				_.each(oldMethods, function (method) {
					var newMethod = _.findWhere(cls.methods, { name: method.name });
					if (!newMethod) {
						newMethod = _.clone(method);
						cls.methods.push(newMethod);
					}
					newMethod.inheritedFrom = method;
				});
				return cls;
			})
		};
	}

	function parseMethods (data, cls) {
		//console.log("DATA", data)
		var methods = [],
			privateMethods = [];

		var re = new RegExp('([^\\\s]*) *: *function *\\\(([^\\\)]*)\\\)', 'g');
		data.replace(re, function (match, name, args, lineNo) {
			//if (classes.length > 0) { classes[classes.length - 1].lineNoEnd = lineNo - 1; }
			var method = {
				name: name,
				args: parseArgs(args),
				lineNoStart: lineNo
			};
			if (name.indexOf('_') === 0) {
				privateMethods.push(method);
			} else {
				methods.push(method);
			}
			//console.log(match, name, lineNo);
			return match;
		});
		//if (classes.length > 0) { classes[classes.length - 1].lineNoEnd = lines.length - 1; }

		methods = _.sortBy(methods, function (method) { return method.lineNoStart; });
		privateMethods = _.sortBy(privateMethods, function (method) { return method.lineNoStart; });

		return {
			methods: methods,
			privateMethods: privateMethods
		};

		/*return _.map(methods, function (method) {
			var data = lines.slice(method.lineNoStart, method.lineNoEnd),
				methods = parseMethods(data, method.name);
			_.extend({ methods: methods }, method);
		});*/
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

}());
