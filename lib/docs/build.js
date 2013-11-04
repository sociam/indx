/* jshint node:true */
(function () {

	'use strict';

	var optimist = require('optimist'),
		path = require('path'),
		u = require('inc/utils.js'),
		Builder = require('inc/builder.js'),
		gu = require('../utils.js');

	var argv = optimist.argv,
		logging = false,
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
		logging = true;
	}

	if (!argv._.length) {
		optimist.showHelp();
		process.exit(1);
	} else {
		u.log('loading config ' + argv._[0]);
		config = require(gu.relativeToCwd(argv._[0]));
	}

	if (argv.o || argv['output-directory']) {
		config.outputDirectory = gu.relativeToCwd(argv.o || argv['output-directory']);
	}

	if (argv.t || argv.template) {
		config.template = argv.o || argv.template;
	}

	config.basePath = gu.relativeTo(config.basePath, path.dirname(gu.relativeToCwd(argv._[0])));



	var builder = new Builder(config);

	u.cacheTemplates()
		.then(function () {
			builder.build();
		});

}());