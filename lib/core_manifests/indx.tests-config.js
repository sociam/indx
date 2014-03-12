
module.exports = {
	// base path, that will be used to resolve files and exclude
	basePath: '../../html/',


	// list of files / patterns to load in the browser
	files: [
		'lib/jquery/jquery.min.js',
		'lib/underscore/underscore.js',
		'lib/backbone/backbone.js',
		'lib/angular/angular.min.js',
		'lib/angular-ui/build/angular-ui.min.js',
		'lib/bootstrap.js',
		'js/indx.js',
		'js/indx-utils.js',
		'js/indx.tests.js'
	],

	// Start these browsers, currently available:
	// - Chrome
	// - ChromeCanary
	// - Firefox
	// - Opera
	// - Safari (only Mac)
	// - PhantomJS
	// - IE (only Windows)
	browsers: ['Chrome']
		
};