module.exports = {
	basePath: '',
	outputDirectory: 'html/',

	require: [
		'../../../lib/docs/abstracts/*',
		//'jsdoc_tests/*'
	],

	files: [
		'js/file.js',
		'js/classes.js',
		'js/attributes.js',
		'js/methods.js'
	],

	project: {
		title: 'Tests',
		version: '0.01',
		description: 'Testing things.'
	},

	template: 'clean'
};
