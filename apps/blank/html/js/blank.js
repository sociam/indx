angular
	.module('BlankApp', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;

		var load_box = function(bid) { 
			s.getBox(bid).then(function(box) {
				console.log('box ', box);
				window.box = box;
			});
		};
		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			s._ajax('GET', 'blank/api/set_config', { config: config }).then(function(x) { 
				console.log('success ', x);
				sa(function() { $scope.status = 'configuration change committed'; });
				window.retval = x;
			}).fail(function(e) {
				console.error(e);
				sa(function() { $scope.status = 'error committing change'; });				
			});
		};s

		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox);	
			}
		});
	});
