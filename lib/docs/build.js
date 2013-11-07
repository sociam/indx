/* jshint node:true */
(function () {

	'use strict';

	var optimist = require('optimist'),
		path = require('path'),
		u = require('./inc/utils.js'),
		Builder = require('./inc/builder.js');

	var argv = optimist.argv,
		config;


	optimist
		.usage('Usage: $0 [config file]')
		.alias('l', 'log-stdout')
		.alias('h', 'help')
		.alias('o', 'output-directory')
		.alias('t', 'template')
		.describe('l', 'Output logs to stdout')
		.describe('h', 'Display help')
		.describe('o', 'Where to create documentation')
		.describe('t', 'Which template to use');

	if (argv.h || argv.help) {
		optimist.showHelp();
		process.exit(0);
	}

	if (argv.l || argv['log-stdout']) {
		u.setLogging(true);
	}

	if (!argv._.length) {
		optimist.showHelp();
		process.exit(1);
	} else {
		u.log('loading config ' + argv._[0]);
		config = require(u.relativeToCwd(argv._[0]));
	}

	if (argv.o || argv['output-directory']) {
		config.outputDirectory = u.relativeToCwd(argv.o || argv['output-directory']);
	}

	if (argv.t || argv.template) {
		config.template = argv.o || argv.template;
	}

	config.basePath = u.relativeTo(config.basePath, path.dirname(u.relativeToCwd(argv._[0])));

	var builder = new Builder(config);
	builder.build();

}());