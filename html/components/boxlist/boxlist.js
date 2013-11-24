/*jslint vars:true, todo:true, sloppy:true */
angular
	.module('indx')
	.directive('boxlist',function() {
		return {
			restrict:'E',
			replace:false,
			templateUrl:'/components/boxlist/list.html',
			link:function($scope, $element) {
				$scope.el = $element;
				$element.find('.login-dialog').on('shown.bs.modal', function() {
					$element.find('.login-username').focus();
				});
				$element.find('.logout-dialog').on('shown.bs.modal', function() { 
					$element.find('.logout-ok').focus();
				});
			},
			scope: { box:"=boxVar", user:"=usernameVar" },
			controller: function($scope, client, backbone, utils) {
			}
		};
	})
	.directive('boxlist-box', function() {
		return {
			restrict:'E',
			replace:false,
			templateUrl:'/components/boxlist/box.html'
		};
	});
