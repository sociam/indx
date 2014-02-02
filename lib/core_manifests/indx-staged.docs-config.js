module.exports = {
	basePath: '../../html/',
	outputDirectory: 'docs/indx-staged/',

	require: [
		'../lib/docs/abstracts/*',
		'js/indx.js'
	],

	files: [
		'js/indx-staged.js'
	],

	project: {
		title: 'INDX Staged',
		version: '0.01',
		description: ''
	},

	template: 'clean'
};
