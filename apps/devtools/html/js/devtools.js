angular
	.module('devtools', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b; 
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		window.s = client.store;
	});
