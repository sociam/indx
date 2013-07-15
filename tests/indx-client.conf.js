// Karma configuration
// Generated on Wed Jun 26 2013 01:13:01 GMT+0100 (BST)


// base path, that will be used to resolve files and exclude
basePath = '../html/';


// list of files / patterns to load in the browser
files = [
  JASMINE,
  JASMINE_ADAPTER,
  'js/vendor/jquery.min.js',
  'js/vendor/underscore.min.js',
  'js/vendor/backbone.min.js',
  'js/vendor/angular-beta.min.js',
  'js/vendor/angular-ui.js',
  'js/vendor/bootstrap.js',
  'js/indx.js',
  'js/indx-utils.js',
  '../tests/indx-client.js'
];

preprocessors = {
  '../tests/indx-client.js': 'coverage',
  'js/indx.js': 'coverage',
  'js/indx-utils.js': 'coverage'
};

coverageReporter = {
  type : 'html',
  dir : '../tests/coverage/'
};

// list of files to exclude
exclude = [

];


// test results reporter to use
// possible values: 'dots', 'progress', 'junit'
reporters = ['progress'/*, 'coverage'*/];


// web server port
port = 9876;


// cli runner port
runnerPort = 9100;


// enable / disable colors in the output (reporters and logs)
colors = true;


// level of logging
// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
logLevel = LOG_INFO;


// enable / disable watching file and executing tests whenever any file changes
autoWatch = true;


// Start these browsers, currently available:
// - Chrome
// - ChromeCanary
// - Firefox
// - Opera
// - Safari (only Mac)
// - PhantomJS
// - IE (only Windows)
browsers = ['Chrome'];


// If browser does not capture in given timeout [ms], kill it
captureTimeout = 60000;


// Continuous Integration mode
// if true, it capture browsers, run tests and exit
singleRun = false;
