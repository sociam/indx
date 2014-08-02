/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery */

angular.module('timon')
	.directive('tipost', function() { 
		return {
			restrict:'E',
			scope:{m:'=model'},
			templateUrl:'tmpl/tipost.html',
			controller:function($scope, channels, utils) {
				// not much needed here
				console.log("scope ", $scope.m);
				window.tweet = $scope.m;
				var u = utils;
				$scope.shortFormat = function(d) { 
					if (new Date().valueOf() - d.valueOf() < 15*60*1000) { 
						return Math.round((new Date().valueOf() - d.valueOf())/(60*1000)) + ' mins ago';
					}
					if (d) { 
						return u.MON_SHORT[d.getMonth()] + ' ' + (d.getDate() + 1) + ' - ' + u.toISOTimeString(d);
					}
				};
			}
		};
	});