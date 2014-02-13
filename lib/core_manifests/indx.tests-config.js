
module.exports = {
	// base path, that will be used to resolve files and exclude
	basePath: '../../html/',


	// list of files / patterns to load in the browser
	files: [
		'js/vendor/jquery/jquery.min.js',
		'js/vendor/underscore/underscore.js',
		'js/vendor/backbone/backbone-min.js',
		'js/vendor/angular/angular.min.js',
		'js/vendor/angular-ui/build/angular-ui.min.js',
		'js/vendor/bootstrap.js',
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