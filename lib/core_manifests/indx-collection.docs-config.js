module.exports = {
	basePath: '../../html/',
	outputDirectory: 'docs/indx-collection/',

	require: [
		'../lib/docs/abstracts/*',
		'js/indx.js'
	],

	files: [
		'js/indx-collection.js'
	],

	project: {
		title: 'INDX Collection',
		version: '0.01',
		description: ''
	},

	template: 'clean'
};
