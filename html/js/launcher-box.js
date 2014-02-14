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
			scope: { box:"=b" },
			controller: function($scope, client, backbone, utils) {
				var u = utils, sa = function(f) { utils.safeApply($scope,f); };
				var guid = u.guid(), old_box;

				$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
				$scope.obj_count = $scope.obj_ids.length;

				$scope.$watch('box', function() { 
					console.log('boxxxxx ', $scope.box);
					if (!$scope.box) { return; }
					if (old_box) { old_box.off(undefined, undefined, guid); }

					$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
					$scope.obj_count = $scope.obj_ids.length;

					$scope.box.on('obj-add', function(result) { 
						// console.log('obj add ', result, typeof(result));
						sa(function() { $scope.obj_count++; });
					}, guid);
					$scope.box.on('obj-remove', function(result) { 
						sa(function() { $scope.obj_count--; });
					}, guid);
					old_box = $scope.box;

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