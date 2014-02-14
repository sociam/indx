var fs = require('fs'),
	gulp = require('gulp'),
	gutil = require('gulp-util'),
	bower = require('gulp-bower'),
	clean = require('gulp-clean'),
	chug = require('gulp-chug');

process.setMaxListeners(100);

gulp.task('dependencies', function () {
	return bower();
});

gulp.task('styles', function () {

});

gulp.task('apps', function (cb) {
/*	fs.readdir('./apps', function (err, apps) {
		if (err) { cb(err); }
		apps.forEach(function (app) {
			var dir = './apps/' + app,
				gruntfile = dir + '/gruntfile.js';
			fs.exists(gruntfile, function (exists) {
				if (exists) {
					bower(gruntfile);
				} else {
					bower(dir);
				}
			})
		});
	});*/

});

gulp.task('clean', function () {
	// todo clean apps
	return gulp.src(['html/lib'], { read: false })
		.pipe(clean());
});

// watch files for changes
gulp.task('watch', function () {
	//gulp.watch('*.less', ['styles']);
});

gulp.task('default', ['clean'], function () {
	gulp.start('dependencies', 'styles', 'apps');
});