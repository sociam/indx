
module.exports = {
  karma: {
    // base path, that will be used to resolve files and exclude
    basePath: 'html/',


    // list of files / patterns to load in the browser
    files: [
      JASMINE,
      JASMINE_ADAPTER,
      '../../../html/js/vendor/jquery.min.js',
      '../../../html/js/vendor/underscore.min.js',
      '../../../html/js/vendor/backbone.min.js',
      '../../../html/js/vendor/angular-beta.min.js',
      '../../../html/js/vendor/angular-ui.js',
      '../../../html/js/vendor/bootstrap.js',
      '../../../html/js/indx.js',
      '../../../html/js/indx-utils.js',
      'js/models.js',
      'js/todos.js',
      'js/tests.js'
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
  }
};