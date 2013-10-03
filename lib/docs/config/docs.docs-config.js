module.exports = {
	basePath: '../../../html/',
	outputDirectory: 'docs/indx/',

	require: [
		'../lib/docs/abstracts/*',
	],

	files: [
		'../lib/docs/build.js'
		//'js/indx-utils.js'
	],

	project: {
		title: 'Documentation generator',
		version: '0.1',
		description: ''
	},

	template: 'clean',

	readme: '../lib/docs/README.md'
};
