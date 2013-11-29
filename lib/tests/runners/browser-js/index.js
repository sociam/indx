// make karma config

// 
//      JASMINE,
//      JASMINE_ADAPTER,

// run karma

var fs = require('fs'),
	Q = require('q'),
	_ = require('underscore'),
	path = require('path'),
	u = require('../../../utils.js'),
	spawn = require('child_process').spawn;


var runner = {};

var config,
	params,
	tmpFiles = [],
	notifyFile = __dirname + '/karma-notify';

function notifyKarma () {
	fs.writeFileSync(notifyFile, '');
};
notifyKarma();

runner.config = function (_config) {
	config = _config;
	return runner;
};

runner.params = function (_params) {
	params = _params;
	return runner;
};

runner.start = function () {
	writeParams().then(function () {
		writeKarmaConfig().then(function (configName) {
			var cmd = u.indxRoot + 'lib/tests/node_modules/.bin/karma';
			console.log('Starting karma', cmd);
			var runner = spawn(cmd, [ 'start', configName ]);

			runner.stdout.on('data', function (data) {
				console.log(String(data).trim());
			});

			runner.stderr.on('data', function (data) {
				console.log(String(data).trim());
			});

			runner.on('close', function (code) {
				console.log('Karma exited with code ' + code);
			});
		});
	});

	process.stdin.resume();//so the program will not close instantly
	process.on('exit', function (){
		console.log('Exiting');
		cleanup();
	});
	process.on('SIGINT', function () {
		process.exit(0);
	});

	return runner;
};

var cleanup = function () {
	console.log('Deleting temporary files');
	var dfds = [];
	_.each(tmpFiles, function (file) {
		var dfd = Q.defer();
		dfds.push(dfd);
		fs.unlink(file, function () {
			dfd.resolve();
		});
	});
	Q.all(dfds).then(function () {
		process.exit(0);
	});
};

runner.run = function () {
	console.log('run');
	notifyKarma();
	return runner;
};

var writeKarmaConfig = function () {
	var deferred = Q.defer();

	var karmaGlobals = ['LOG_DISABLE', 'LOG_ERROR', 'LOG_WARN', 'LOG_INFO',
		'LOG_DEBUG', 'JASMINE', 'JASMINE_ADAPTER', 'MOCHA', 'MOCHA_ADAPTER',
		'QUNIT', 'QUNIT_ADAPTER', 'REQUIRE', 'REQUIRE_ADAPTER',
		'ANGULAR_SCENARIO', 'ANGULAR_SCENARIO_ADAPTER'];

	_.each(karmaGlobals, function (glob) {
		global[glob] = glob;
	});
	
	var karmaConfig = {
		basePath: config.basePath,
		files: _.map(config.files, function (file) {
			return _(file).extend({
				watched: false // Don't watch the files, indx test runner does that for us
			});
		}).concat([notifyFile]),
		reporters: ['progress', 'junit'], // possible values: 'dots', 'progress', 'junit'
		port: 9876, // web server port
		runnerPort: 9100, // cli runner port
		colors: true, // enable colors in the output (reporters and logs)
		// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
		logLevel: LOG_INFO,
		autoWatch: true, // we're actually just going to watch one file
		// Available: Chrome, ChromeCanary, Firefox, Opera, Safari, PhantomJS, IE
		browsers: config.browsers || ['Chrome'],
		captureTimeout: 60000, // If browser does not capture in given timeout [ms], kill it
		singleRun: false, // run tests and exit

		junitReporter: {
			outputFile: config.outputDirectory + '/test-results.xml'
		}
	};


	// Build the karma config file
	var karmaConfigStr = _.map(karmaConfig, function (v, k) {
		return 'var ' + k + ' = ' + JSON.stringify(v, null , ' ') + ';';
	}).join('\n');
	// put back karma globals
	_.each(karmaGlobals, function (glob) {
		karmaConfigStr = karmaConfigStr.replace('"' + glob + '"', glob);
	});
	
	var tmpName = '/tmp/tmp.karma-config-' + (Math.random() * 100000000) + '.js';
	console.log('Writing temporary config to ' + tmpName);

	fs.writeFile(tmpName, karmaConfigStr, function (err) {
		if (err) { throw err; }
		tmpFiles.push(tmpName);
		deferred.resolve(tmpName);
	});
	return deferred.promise;
};

var writeParams = function () {
	// Write the params to a file
	var deferred = Q.defer();

	if (params) {
		var name = 'tmp.karma-params-' + Math.round(Math.random() * 1000000) + '.js',
			fPath = path.normalize(config.basePath + '/' + name),
			content = 'window.params = ' + JSON.stringify(params) + ';';
		
		console.log('Writing params to ' + fPath);

		fs.writeFile(fPath, content, function (err) {
			if (err) { throw 'Error writing params'; }
			deferred.resolve();
		});
		config.files.unshift(name);
		tmpFiles.push(fPath);
	} else {
		deferred.resolve();
	}
	return deferred.promise;
}

module.exports = runner;

