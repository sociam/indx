/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $ */

angular
.module('vitalityApp')
.controller('KeySetController', function($scope, $location, utils, client) { 
		var u = utils, 
			sa = function(fn) { return u.safeApply($scope, fn); },
			$s = $scope,
			whom, box, store = client.store,
			getUser = function() { 
				if ($scope.box !== undefined && $scope.user !== undefined) {
					return store.getBox($scope.box).pipe(function(b) { 
						return b.getObj($scope.user.username);
					});
				} 
				return u.dreject('box or user not defined');
			},
			loadkeys = function() { 
				var d = u.deferred();
				getUser().then(function(user) {
					sa(function() { 
						$scope.privatekey = user.peek('privatekey') || '';
						$scope.pubkey = user.peek('pubkey') || '';
					});
				}).fail(d.reject);
				return d.promise();
			};

		$scope.$watch('box', function(boxx) { 
			box = boxx; 
			loadkeys();
		});

		$scope.$watch('user', function(auth_result) { 
			if (!auth_result.is_authenticated) { 
				console.log('not authenticated, redirecting to init');
				return sa(function() { $location.path('/'); });
		    } 
		    sa(function() {
				$scope.username = auth_result.username;
				$scope.first_name = auth_result.first_name;
				$scope.last_name = auth_result.last_name;
		    });
		});
		$scope.save = function() { 
			$location.path('/');	
		};
		$scope.cancel = function() { $location.path('/'); };

	});