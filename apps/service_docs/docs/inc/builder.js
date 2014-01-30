/* jshint node:true */
(function () {

	'use strict';
	var fs = require('fs'),
		_ = require('underscore'),
		mu = require('mustache'),
		Q = require('q'),
		CJSON = require('circular-json'),
		ncp = require('ncp'),
		globp = require('glob'),
		Backbone = require('backbone'),
		marked = require('marked'),
		u = require('./utils.js'),
		Files = require('./files.js'),
		Classes = require('./classes.js'),
		ObjectClass = require('./classes').ObjectClass;

	var Builder = Backbone.Model.extend({
		initialize: function () {
			var that = this,
				readmeDfd = Q.defer(),
				buildDfd = Q.defer(),
				templateDfd = Q.defer();

			this.ready = Q.all([readmeDfd.promise, buildDfd.promise, templateDfd.promise]);
			that.files = new Files();
			this.superclasses = new Classes([new ObjectClass()], {
				builder: this
			});

			this.templateRoot = u.relativeTo('../template/' + (this.get('template') || 'clean') + '/', __dirname);
			this.templateCache = {};

			mu.root = this.templateRoot;

			if (this.get('readme')) {
				fs.readFile(u.relativeTo(this.get('readme'), this.get('basePath')), function (err, content) {
					if (err) {
						throw err;
					}
					marked(content.toString(), u.markedOptions, function (err, html) {
						if (err) {
							throw err;
						}
						that.set('readmeDescription', html);
					});
					readmeDfd.resolve();
				});
			} else {
				readmeDfd.resolve();
			}

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
					buildDfd.resolve();
				});


			this.cacheTemplates().then(function () {
				templateDfd.resolve();
			});
		},
		build: function () {
			var that = this;

			this.ready.then(function () {
				u.log('build', 'starting build process');
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

			u.log('build', 'rendering to ' + outputDir);

			u.rmdirRecursive(outputDir);
			u.mkdirRecursive(outputDir);
			ncp(this.templateRoot, outputDir, function (err) {
				if (err) {
					throw err;
				}
				html = mu.render(that.templateCache['index.mu'], that.object(), that.templateCache);

				fs.writeFile(outputDir + '/index.html', html, function (err) {
					if (err) {
						throw err;
					}
					u.summary();
					u.log('Successfully built documentation in ' + outputDir, true);
				});
			});
		},
		// Expands globs into paths
		_buildFilePaths: function () {
			u.log('build', 'building file paths');
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
								u.log('warning', glob + ' did not match any files');
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
					u.log('build', 'got ' + (fileLists.require.length + fileLists.files.length) +
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
		},

		cacheTemplates: function (path) {
			var that = this,
				deferred = Q.defer();
			path = path || '';
			fs.readdir(this.templateRoot + path, function (err, files) {
				if (err) {
					throw err;
				}
				var promises = [];
				_.each(files, function (file) {
					var filename = path + file;
					if (fs.lstatSync(that.templateRoot + filename)
						.isDirectory()) {
						promises.push(that.cacheTemplates(filename + '/'));
					} else if (file.indexOf('.mu', file.length - 3) > -1) { // ends with .mu
						var deferred = Q.defer();
						u.log('caching mustache', filename);
						fs.readFile(that.templateRoot + filename, function (err, data) {
							if (err) {
								throw err;
							}
							that.templateCache[filename] = data.toString();
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
		}
	});

	module.exports = Builder;
}());