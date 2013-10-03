module.exports = {
	basePath: '',
	outputDirectory: 'html/',

	require: [
		'../../../lib/docs/abstracts/*',
	],

	files: [
		'js/main.js'
	],

	project: {
		title: 'Tests',
		version: '0.01',
		description: 'Testing things.'
	},

	template: 'clean'
};
