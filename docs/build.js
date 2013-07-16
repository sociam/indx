
(function () {

	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		config = require('./config.js');

	fs.readFile(config.basePath + config.files[0], function (err, data) {
		if (err) { throw err; }

		var classes = parseClasses(data.toString());
		console.log(classes);
	});



	function parseClasses (data) {
		var classes = [];

		_.each(config.classes, function (className) {
			var re = new RegExp('([^\\\s]*) *= *' + className + '\\\.extend\\\(', 'g');
			data.replace(re, function (match, name, pos) {
				if (classes.length > 0) { classes[classes.length - 1].end = pos - 1; }
				classes.push({ name: name, start: pos });
				//console.log(match, name, pos);
				return match;
			});
			if (classes.length > 0) { classes[classes.length - 1].end = data.length - 1; }
		});

		classes = _.sortBy(classes, function (cls) { return cls.start; });

		return _.map(classes, function (cls) {
			var subdata = data.substring(cls.start, cls.end),
				methods = parseMethods(subdata, cls.name);
			return _.extend({ methods: methods }, cls);
		});
	}

	function parseMethods (data, cls) {
		//console.log("DATA", data)
		var lines = data.split(','),
			methods = [];

		var re = new RegExp('([^\\\s]*) *: *function *\\\(([^\\\)]*)\\\)', 'g');
		data.replace(re, function (match, name, lineNo) {
			//if (classes.length > 0) { classes[classes.length - 1].lineNoEnd = lineNo - 1; }
			methods.push({ name: name, lineNoStart: lineNo });
			//console.log(match, name, lineNo);
			return match;
		});
		//if (classes.length > 0) { classes[classes.length - 1].lineNoEnd = lines.length - 1; }

		methods = _.sortBy(methods, function (method) { return methods.lineNoStart; });

		return methods;

		/*return _.map(methods, function (method) {
			var data = lines.slice(method.lineNoStart, method.lineNoEnd),
				methods = parseMethods(data, method.name);
			_.extend({ methods: methods }, method);
		});*/
	}

}());
