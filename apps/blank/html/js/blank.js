angular
	.module('BlankApp', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;

		var load_box = function(bid) { 
			s.getBox(bid).then(function(box) {
				console.log('box ', box);
				window.box = box;

				// get the users
				s.getUserList().then(function(u) { 
					console.info(' users ', u);
					sa(function() { $scope.users = u; });
				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting user list'; });
					console.error(e);
				});

				// get the users
				s.getBoxList().then(function(boxes) { 
					console.info(' boxes ', boxes);
					sa(function() { $scope.boxes = boxes; });
				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting box list'; });
					console.error(e);
				});
			});
		};
		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			s._ajax('GET', 'apps/blank/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
				console.log('success ', x);
				sa(function() { $scope.status = 'configuration change committed'; });
				window.retval = x;
			}).fail(function(e) {
				console.error(e);
				sa(function() { $scope.status = 'error committing change'; });				
			});
		};

		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox);	
			}
		});
	});
