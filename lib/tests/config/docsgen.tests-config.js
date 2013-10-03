
	// Karma configuration
	// Generated on Wed Jun 26 2013 01:13:01 GMT+0100 (BST)


	// base path, that will be used to resolve files and exclude
	var basePath = '/home/peter/webbox/lib/docs/tests/';

	var frameworks = ['jasmine'];

	// list of files / patterns to load in the browser
	var files = [
	  JASMINE,
	  JASMINE_ADAPTER,
	  { pattern: '../build.js', watched: true, served: false, included: false },
	  { pattern: 'tests.docs-config.js', watched: true, served: false, included: false },
	  { pattern: 'js/main.js', watched: true, served: false, included: false },

	  { pattern: 'lib/jquery-1.9.1.min.js', watched: true, served: true, included: true },
	  { pattern: 'lib/jasmine-jquery.js', watched: true, served: true, included: true },
	  { pattern: 'html/index.html', watched: true, served: true, included: false },

	  { pattern: 'main-tests.js', watched: true, served: true, included: true }
	];

	// test results reporter to use
	// possible values: 'dots', 'progress', 'junit'
	var reporters = ['progress'];

	// web server port
	var port = 9876;


	// cli runner port
	var runnerPort = 9100;


	// enable / disable colors in the output (reporters and logs)
	var colors = true;


	// level of logging
	// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
	//var logLevel = LOG_INFO;


	// enable / disable watching file and executing tests whenever any file changes
	var autoWatch = true;


	// Start these browsers, currently available:
	// - Chrome
	// - ChromeCanary
	// - Firefox
	// - Opera
	// - Safari (only Mac)
	// - PhantomJS
	// - IE (only Windows)
	var browsers = ['Chrome'];


	// If browser does not capture in given timeout [ms], kill it
	var captureTimeout = 60000;


	// Continuous Integration mode
	// if true, it capture browsers, run tests and exit
	var singleRun = true;