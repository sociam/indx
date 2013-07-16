
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mu2'),
		config = require('./config.js');

	mu.root = __dirname + '/templates';

	fs.readFile(config.basePath + config.files[0], function (err, data) {
		if (err) { throw err; }

		var app = _.extend(parseClasses(data.toString()), {
				title: 'INDX',
				version: '0.01'
			}),
			html = '';

		mu.compileAndRender('index.html', app).on('data', function (dat) {
			html += dat.toString();
		}).on('end', function () {
			fs.writeFile('./build/index.html', html, function (err) {
				if (err) { throw err; }
			});
		});

	});



	function parseClasses (data) {
		var classes = [];

		_.each(config.classes, function (className) {
			var re = new RegExp('([^\\\s]*) *= *' + className + '\\\.extend\\\(', 'g');
			data.replace(re, function (match, name, pos) {
				if (classes.length > 0) { classes[classes.length - 1].end = pos - 1; }
				classes.push({
					uid: name.replace(/\W/gi, ''),
					name: name,
					start: pos
				});
				//console.log(match, name, pos);
				return match;
			});
			if (classes.length > 0) { classes[classes.length - 1].end = data.length - 1; }
		});

		classes = _.sortBy(classes, function (cls) { return cls.start; });

		return {
			classes: _.map(classes, function (cls) {
				var subdata = data.substring(cls.start, cls.end),
					methods = parseMethods(subdata, cls.name);
				return _.extend(methods, cls);
			})
		};
	}

	function parseMethods (data, cls) {
		//console.log("DATA", data)
		var methods = [],
			privateMethods = [];

		var re = new RegExp('([^\\\s]*) *: *function *\\\(([^\\\)]*)\\\)', 'g');
		data.replace(re, function (match, name, lineNo) {
			//if (classes.length > 0) { classes[classes.length - 1].lineNoEnd = lineNo - 1; }
			var method = {
				name: name,
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

}());
