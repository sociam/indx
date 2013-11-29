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
		spawn = require('child_process').spawn,
		glob = require('glob'),
		Emitter = require('events').EventEmitter;

	var argv = optimist.argv,
		logging = false,
		configPath,
		config,
		runner,
		files,
		promises = [],
		tmpFiles = [],
		emitter = new Emitter(),
		singleRun = true;


	var log = function (msg) {
		if (logging === false) {
			return;
		}
		console.log(msg);
	};

	var runnersDir = __dirname + '/runners'
	var runners = _(fs.readdirSync(runnersDir)).filter(function (file) {
		return fs.lstatSync(runnersDir + '/' + file).isDirectory();
	});

	var usage = ['Usage: $0 [test-runner] [config file]',
			'Run test config using specified test runner',
			'',
			'Available test runners:'];

	_.each(runners, function (runner) {
		usage.push('  * ' + runner);
	});

	optimist
		.usage(usage.join('\n'))
		.alias('l', 'log-stdout')
		.alias('h', 'help')
		.alias('o', 'output-directory')
		.alias('p', 'params')
		.alias('s', 'single-run')
		.boolean('s')
		.describe('l', 'Output logs to stdout')
		.describe('h', 'Display help')
		.describe('o', 'Where to put test results')
		.describe('p', 'Parameters (in JSON) to pass to tests')
		.describe('s', 'Run testing only once');

	if (argv.h || argv.help) {
		optimist.showHelp();
		process.exit(0);
	}

	if (argv.l || argv['log-stdout']) {
		logging = true;
	}

	if (argv._.length < 2) {
		optimist.showHelp();
		process.exit(1);
	} else {
		log('Loading test-runner ' + argv._[0]);
		runner = require('./runners/' + argv._[0]); // node will look for index.js
		log('Loading config ' + argv._[1]);
		configPath = u.relativeToCwd(argv._[1]);
		config = require(configPath);
	}

	if (argv.o || argv['output-directory']) {
		config.outputDirectory = u.relativeToCwd(argv.o || argv['output-directory']);
	} else {
		config.outputDirectory = __dirname;
	}

	if (argv.s || argv['single-run']) {
		singleRun = true;
	}

	// Make basePath absolute
	if (config.basePath.indexOf('/') !== 0) {
		config.basePath = path.normalize(path.dirname(configPath) + '/' + config.basePath);
	}
	
	if (argv.p || argv.params) {
		runner.params(JSON.parse(argv.p || argv.params));
	}

	config.globs = config.files;
	config.files = _(config.globs).reduce(function (files, pattern) {
		var originalFile;

		if (_.isObject(pattern)) {
			originalFile = pattern;
			pattern = originalFile.pattern;
		}
		
		var newFiles = glob.sync(path.normalize(config.basePath + pattern));
		
		return files.concat(_.map(newFiles, function (file) {
			return _.extend({
				watched: true,
				served: true,
				included: true
			}, originalFile, { pattern: file });
		}));

	}, []);

	// watch files
	_.each(config.files, function (file) {
		// note: node documentation lists this as "unstable"
		if (file.watched) {
			fs.watch(file.pattern, function (status) {
				if (status === 'change') {
					log('Saw change on file ' + file.pattern);
					run();
				}
			});
		}
	});

	if (config.initialize) {
		config.initialize.call(emitter);
	}

	function run (start) {
		var _run = start ? runner.start : runner.run;
		var eventOptions = {};
		emitter.emit('before-run');
		if (eventOptions.wait) {
			eventOptions.wait().then(function () {
				_run();
			});
		} else {
			_run();
		}
	};
	runner.config(config);
	run(true);

}(this));