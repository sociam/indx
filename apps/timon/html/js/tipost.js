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
				var u = utils;
				$scope.shortFormat = function(d) { 
					console.log('shortFormat >> ', d);
					if (d) { 
						return u.MON_SHORT[d.getMonth()] + ' ' + (d.getDate() + 1) + u.toISOTimeString(d);
					}
				};
			}
		};
	});