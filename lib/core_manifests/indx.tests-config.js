
module.exports = {
	// base path, that will be used to resolve files and exclude
	basePath: '../../html/',


	// list of files / patterns to load in the browser
	files: [
		'js/vendor/jquery.min.js',
		'js/vendor/underscore.min.js',
		'js/vendor/backbone.min.js',
		'js/vendor/angular-beta.min.js',
		'js/vendor/angular-ui.js',
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
	browsers: ['Chrome', 'Firefox']
		
};