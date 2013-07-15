var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;

angular
	.module('indx')
	.controller('coreDebug', function($scope, client, utils) {
		$scope.$watch('selected_box', function() {
			var b = $scope.selected_box;			
			client.store.get_box(b).then(function(box) {
				utils.debug('Selected box ', b, ' now bound to b ');
				window.b = box;
			});
		});
	});
