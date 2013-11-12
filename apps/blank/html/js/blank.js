angular
	.module('BlankApp', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		window.store = client.store;
	});
