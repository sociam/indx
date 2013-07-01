angular
	.module('SelectTest', ['webbox-widgets'])
	.controller('SelectTestCtrl', function($scope, webbox) {
		webbox.loaded.then(function() {
			console.log('loaded');
			$scope.$watch('boo', function(){ console.log('boo change !', $scope.boo); });
		});
	});

