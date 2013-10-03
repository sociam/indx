module.exports = {
	basePath: 'html/',
	outputDirectory: 'docs/docs/',

	require: [
		'../../../lib/docs/abstracts/*',
	],

	files: [
		'js/models.js',
		'js/todos.js',
	],

	project: {
		title: 'Todos',
		version: '1',
		description: 'A simple todo list app.'
	},

	template: 'clean'
};
