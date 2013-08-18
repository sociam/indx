angular.module('launcher', ['ui','indx'])
	.directive('user',function() {
		return {
			restrict:'E',
			templateUrl:'templates/user.html',
			scope:{user:"=model"},
			replace:true
		};
	}).directive('loginbox',function() {
		return {
			restrict:'E',
			replace:true,
			templateUrl:'templates/userlist.html',
			link:function($scope, $element) { $scope.el = $element;	},
			controller: function($scope, client, backbone, utils) {
				var u = utils, store = client.store, sa = function(f) { return utils.safe_apply($scope,f); };
				window._s = $scope;
				$scope.select_user = function(user) {
					u.log('select_user! ', user);
					$scope.user_selected = user;
				};				
				// this gets called when the form is submitted
				$scope.do_submit = function() {
					store.login($scope.user_selected, $scope.password).then(function() {
						u.debug('login okay!');
						sa($scope.back_to_login);
					}).fail(function() {
						u.shake($($scope.el).find('input:password').parents('.launcher_window'));						
					});
				};
				$scope.back_to_login = function() {
					delete $scope.user_selected; delete $scope.password;
				};
				store.get_user_list().then(function(result) {
					u.log('users > ', result);
					sa(function() { $scope.users = result; });
				}).fail(function(err) { u.error(err); })
				$scope.$watch('user_logged_in', function() {
					console.log('change on user logged in ', $scope.user_logged_in);
				});
				window._set_user_logged_in = function(user) { sa(function() { $scope.user_logged_in = user; }); };
			}			
		};
	}).directive('appslist',function() {
		return {
			restrict:'E',
			replace:true,
			templateUrl:'templates/appslist.html',
			link:function($scope, $element) { $scope.el = $element;	},
			controller: function($scope, client, backbone, utils) {
			}
		};
	}).controller('main', function($scope, client, utils) {});

