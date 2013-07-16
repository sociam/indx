module.exports = {
	basePath: '../html/',

	files: [
		//'js/vendor/backbone.min.js',
		'js/indx.js',
		'js/indx-utils.js'
	],

	project: {
		title: 'INDX',
		version: '0.01',
		description: 'INDX is a personal file store being developed at the University of Southampton, for the SOCIAM project.'
	},

	superclasses: {
		'Backbone.Model': {
			methods: [
				{ name: 'extend' },
				{ name: 'initialize' },
				{ name: 'get' },
				{ name: 'set' },
				{ name: 'escape' },
				{ name: 'has' },
				{ name: 'unset' },
				{ name: 'clear' },
				{ name: 'toJSON' },
				{ name: 'initialize' },
				{ name: 'fetch' },
				{ name: 'save' },
				{ name: 'destroy' },
				{ name: 'isValid' },
				{ name: 'clone' },
				{ name: 'isNew' },
				{ name: 'hasChanged' },
				{ name: 'previous' },
				{ name: 'changedAttributes' },
				{ name: 'previousAttributes' }
			],
			properties: [
				{ name: 'id' },
				{ name: 'attributes' },
				{ name: 'cid' },
				{ name: 'changed' },
				{ name: 'url' },
				{ name: 'urlRoot' }
			]
		},
		'Backbone.Collection': {
			methods: [
				{ name: 'extend' },
				{ name: 'initialize' },
				{ name: 'add' },
				{ name: 'remove' },
				{ name: 'reset' },
				{ name: 'get' },
				{ name: 'set' },
				{ name: 'at' },
				{ name: 'push' },
				{ name: 'pop' },
				{ name: 'unshift' },
				{ name: 'shift' },
				{ name: 'slice' },
				{ name: 'sort' },
				{ name: 'pluck' },
				{ name: 'where' },
				{ name: 'findWhere' },
				{ name: 'clone' },
				{ name: 'fetch' },
				{ name: 'create' }
			],
			properties: [
				{ name: 'model' },
				{ name: 'models' },
				{ name: 'length' }
			]
		},
		'Backbone.View': {
			methods: [
				{ name: 'fetch' }
			]
		}
	}
};
