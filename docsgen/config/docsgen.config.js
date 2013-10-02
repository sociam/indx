module.exports = {
	basePath: './tests/',
	outputDirectory: './tests/html/',

	require: [
		'../abstracts/*',
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
