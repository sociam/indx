/* jshint node:true */
(function (root) {
	'use strict';

	var fs = require('fs'),
		path = require('path');

	var cwd = process.cwd();

	var indxRoot = path.normalize(__dirname + '/../');

	var rmdirRecursive = function (path) {
		var files = [];
		if (fs.existsSync(path)) {
			files = fs.readdirSync(path);
			files.forEach(function (file) {
				var curPath = path + '/' + file;
				if (fs.statSync(curPath)
					.isDirectory()) { // recurse
					rmdirRecursive(curPath);
				} else { // delete file
					fs.unlinkSync(curPath);
				}
			});
			fs.rmdirSync(path);
		}
	};

	var mkdirRecursive = function (path, root) {

		var dirs = path.split('/'),
			dir = dirs.shift();

		root = (root || '') + dir + '/';

		try {
			fs.mkdirSync(root);
		} catch (e) {
			//dir wasn't made, something went wrong
			if (!fs.statSync(root)
				.isDirectory()) throw new Error(e);
		}

		return !dirs.length || mkdirRecursive(dirs.join('/'), root);
	};

	var relativeToScript = function (path) {
		return relativeTo(path, __dirname);
	};

	var relativeToCwd = function (path) {
		return relativeTo(path, cwd);
	};

	var relativeTo = function (p, root) {
		if (p.indexOf('/') !== 0) {
			p = root + '/' + p;
		}
		return path.normalize(p);
	};

	module.exports = {
		rmdirRecursive: rmdirRecursive,
		mkdirRecursive: mkdirRecursive,
		relativeTo: relativeTo,
		relativeToCwd: relativeToCwd,
		relativeToScript: relativeToScript,
		indxRoot: indxRoot
	};
}(this));