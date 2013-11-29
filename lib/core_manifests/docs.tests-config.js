/* jshint node: true */
var spawn = require('child_process').spawn;
module.exports = {

	initialize: function () {
		this.on('before-run', function (options) {
			'use strict';

			var deferred = Q.defer();
			options.wait = deferred.promise;

			console.log('cwd', __dirname);
			console.log('node ../docs/build.js ../docs/tests/tests.docs-config.js');

			var runner = spawn('node', [
				'../docs/build.js',
				'../docs/tests/tests.docs-config.js'
			], {
				cwd: __dirname
			});
			runner.stdout.on('data', function (data) {
				console.log(String(data));
			});

			runner.stderr.on('data', function (data) {
				console.log(String(data));
			});

			runner.on('close', function (code) {
				console.log('exited with code ' + code);
				deferred.resolve();
			});
		});
	},

	// base path, that will be used to resolve files and exclude
	basePath: '../docs/tests/',

	// list of files / patterns to load in the browser
	files: [
	  { pattern: '../build.js', watched: true, served: false, included: false },
	  { pattern: 'tests.docs-config.js', watched: true, served: false, included: false },
	  { pattern: 'js/main.js', watched: true, served: false, included: false },

	  { pattern: 'lib/jquery-1.9.1.min.js', watched: true, served: true, included: true },
	  { pattern: 'lib/jasmine-jquery.js', watched: true, served: true, included: true },
	  { pattern: 'html/index.html', watched: true, served: true, included: false },

	  { pattern: 'main-tests.js', watched: true, served: true, included: true }
	]
};