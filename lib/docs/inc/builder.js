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
}());