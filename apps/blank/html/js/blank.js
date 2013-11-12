angular
	.module('BlankApp', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store;
		window.store = client.store;

		var load_box = function(bid) { 
			s.getBox(bid).then(function(box) {
				console.log('box ', box);
				window.box = box;
			});
		};

		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
		};

		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox);	
			}
		});
	});
