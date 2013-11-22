/* jshint node:true */
(function (root) {

	'use strict';

	var fs = require('fs'),
		path = require('path'),
		_ = require('underscore'),
		Promise = require('node-promise')
			.Promise,
		all = require('node-promise').all,
		optimist = require('optimist'),
		u = require('../utils.js'),
		spawn = require('child_process').spawn;

	var argv = optimist.argv,
		logging = false,
		configPath,
		config,
		promises = [],
		tmpFiles = [],
		singleRun = true;


	var log = function (msg) {
		if (logging === false) {
			return;
		}
		console.log(msg);
	};

	var angularGlobals = ['LOG_DISABLE', 'LOG_ERROR', 'LOG_WARN', 'LOG_INFO',
		'LOG_DEBUG', 'JASMINE', 'JASMINE_ADAPTER', 'MOCHA', 'MOCHA_ADAPTER',
		'QUNIT', 'QUNIT_ADAPTER', 'REQUIRE', 'REQUIRE_ADAPTER',
		'ANGULAR_SCENARIO', 'ANGULAR_SCENARIO_ADAPTER'];

	_.each(angularGlobals, function (glob) {
		global[glob] = glob;
	});

	optimist
		.usage('Usage: $0 [config file]')
		.alias('l', 'log-stdout')
		.alias('h', 'help')
		.alias('o', 'output-directory')
		.alias('p', 'params')
		.alias('c', 'continuous')
		.boolean('c')
		.describe('l', 'Output logs to stdout')
		.describe('h', 'Display help')
		.describe('o', 'Where to put test results')
		.describe('p', 'Parameters (in JSON) to pass to tests')
		.describe('c', 'Run testing continuously');

	if (argv.h || argv.help) {
		optimist.showHelp();
		process.exit(0);
	}

	if (argv.l || argv['log-stdout']) {
		logging = true;
	}

	if (!argv._.length) {
		optimist.showHelp();
		process.exit(1);
	} else {
		log('loading config ' + argv._[0]);
		configPath = u.relativeToCwd(argv._[0]);
		config = require(configPath);
	}

	if (argv.o || argv['output-directory']) {
		config.outputDirectory = u.relativeToCwd(argv.o || argv['output-directory']);
	} else {
		config.outputDirectory = __dirname;
	}

	if (argv.c || argv.continuous) {
		singleRun = false;
	}

	_.defaults(config.karma, {

		// test results reporter to use
		// possible values: 'dots', 'progress', 'junit'
		reporters: ['progress', 'junit'],

		// web server port
		port: 9876,

		// cli runner port
		runnerPort: 9100,


		// enable / disable colors in the output (reporters and logs)
		colors: true,


		// level of logging
		// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
		logLevel: LOG_INFO,


		// enable / disable watching file and executing tests whenever any file changes
		autoWatch: true,


		// Start these browsers, currently available:
		// - Chrome
		// - ChromeCanary
		// - Firefox
		// - Opera
		// - Safari (only Mac)
		// - PhantomJS
		// - IE (only Windows)
		browsers: ['Chrome'],


		// If browser does not capture in given timeout [ms], kill it
		captureTimeout: 60000,


		// Continuous Integration mode
		// if true, it capture browsers, run tests and exit
		singleRun: singleRun,

		junitReporter: {
			outputFile: config.outputDirectory + '/test-results.xml'
		}
	});

	// Make basePath absolute so karma can find it
	if (config.karma.basePath.indexOf('/') !== 0) {
		config.karma.basePath = path.normalize(path.dirname(configPath) + '/' + config.karma.basePath);
	}

	if (argv.p || argv.params) {
		var tmpParamsPromise = new Promise(),
			params = JSON.parse(argv.p || argv.params),
			tmpParamsName = 'tmp.karma-params-' + Math.round(Math.random() * 1000000) + '.js',
			tmpParamsPath = path.normalize(config.karma.basePath + '/' + tmpParamsName),
			content = 'window.params = ' + JSON.stringify(params) + ';';
		fs.writeFile(tmpParamsPath, content, function (err) {
			if (err) { throw 'Error writing params'; }
			tmpParamsPromise.resolve();
		});
		promises.push(tmpParamsPromise);
		console.log(content, '-->', tmpParamsPath);
		console.log(config)
		config.karma.files.unshift(tmpParamsName);
		tmpFiles.push(tmpParamsPath);
	}

	// Build the karma config file
	var karmaConfig = '';
	_.each(config.karma, function (v, k) {
		karmaConfig += 'var ' + k + ' = ' + JSON.stringify(v, null , ' ') + ';\n';
	});
	// put back karma globals
	_.each(angularGlobals, function (glob) {
		karmaConfig = karmaConfig.replace('"' + glob + '"', glob);
	});

	all(promises).then(function () {

		var ready = new Promise();
		if (config.before) {
			config.before(ready);
		} else {
			ready.resolve();
		}

		ready.then(function () {
			var tmpName = '/tmp/tmp.karma-config-' + (Math.random() * 100000000) + '.js';
			console.log('Writing temporary config to ' + tmpName);
			fs.writeFile(tmpName, karmaConfig, function (err) {
				if(err) throw err;
				console.log('Starting karma');
				var runner = spawn(u.indxRoot + 'lib/tests/node_modules/.bin/karma', [ 'start', tmpName ]);
				runner.stdout.on('data', function (data) {
					console.log(String(data));
				});

				runner.stderr.on('data', function (data) {
					console.log(String(data));
				});

				runner.on('close', function (code) {
					console.log('Karma exited with code ' + code);
					console.log('Deleting temporary files');
					_.each(tmpFiles, function (file) {
						fs.unlink(file, function () {
							process.exit(code);
						});
					});
				});
			});
		});
	});

	//

}(this));