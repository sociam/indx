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
				$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
				$scope.obj_count = $scope.obj_ids.length;
				$scope.box.on('obj-add', function(result) { 
					// console.log('obj add ', result, typeof(result));
					sa(function() { $scope.obj_count++; });
				});
				$scope.box.on('obj-remove', function(result) { 
					sa(function() { $scope.obj_count--; });
				});
				$scope.deleteBox = function() {
					console.log("Attempting to delete box ", $scope.box);
					$scope.box.deleteBox($scope.box.getID());
				};
				$scope.emptyBox = function() {
					console.log("Attempting to empty box ", $scope.box);
					$scope.box._doDelete($scope.obj_ids).then(function() {
						sa(function() { 
							$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
							$scope.obj_count = $scope.obj_ids.length;
						});
					});
				};
			}
		};
	});