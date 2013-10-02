module.exports = {
	basePath: '../html/',
	outputDirectory: '../html/docs/indx-collection/',

	require: [
		'../docsgen/abstracts/*',
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
