/*jslint vars:true, todo:true, sloppy:true */
angular.module('launcher')
	.directive('indxBoxlistBox',function() {
		return {
			restrict:'E',
			replace:false,
			templateUrl:'templates/box.html',
			link:function($scope, $element) {
				$scope.el = $element;
			},
			scope: { box:"=box" },
			controller: function($scope, client, backbone, utils) {
				var u = utils, sa = function(f) { utils.safeApply($scope,f); };
				$scope.obj_count = $scope.box ? $scope.box.getObjIDs().length : 0;
				$scope.box.on('obj-add', function(result) { 
					// console.log('obj add ', result, typeof(result));
					sa(function() { $scope.obj_count++; });
				});
			}
		};
	});