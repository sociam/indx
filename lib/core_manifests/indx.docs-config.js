module.exports = {
	basePath: '../../html/',
	outputDirectory: 'docs/indx/',

	require: [
		'../lib/docs/abstracts/*',
	],

	files: [
		'js/indx.js'
		//'js/indx-utils.js'
	],

	project: {
		title: 'INDX',
		version: '0.01',
		description: 'INDX is a personal file store being developed at the University of Southampton, for the SOCIAM project.'
	},

	template: 'clean',

	readme: '../README.md'
};
