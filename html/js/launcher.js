
(function() {
	angular.module('launcher', ['indx'])
		.config(['$routeProvider', function($routeProvider) {
			$routeProvider
			.when('/', {templateUrl: 'templates/root.html', controller:"Root", requireslogin:false})
			.when('/login', {templateUrl: 'templates/userlist.html',   controller:"Login", requireslogin:false})
			.when('/logout', {templateUrl: 'templates/root.html',   controller:"Logout", requireslogin:true})
			.when('/apps', {templateUrl: 'templates/appslist.html', controller:"AppsList", requireslogin:true})
			.when('/boxeslist', {templateUrl:'templates/boxeslist.html', controller:'BoxesList', requireslogin:true})
			.otherwise({redirectTo: '/'});
		}])
	.controller('Root', function($scope, $location, client, utils) {
		// root just redirects to appropriate places
		client.store.checkLogin().then(function(login) {
			if (login.is_authenticated) {
				u.safeApply($scope, function() { $location.path('/apps'); });
			} else {
				console.log('routing to login');
				u.safeApply($scope, function() { $location.path('/login'); });
			}
		});
	}).controller('Logout', function($scope, $location, client, utils) {
		// root just redirects to appropriate places
		console.log('route::logout', client);
		try{
			client.store.logout().then(function(login) {
				try {
					utils.safeApply($scope, function() { $location.path('/login'); });
				} catch(e) { console.error(e); }
			}).fail(function(err) { console.error(err); });
		} catch(e) { console.error(e); }
	}).directive('user',function() {
		return {
			restrict:'E',
			templateUrl:'templates/user.html',
			scope:{user:"=model"},
			replace:true
		};
	}).controller('Login',function($scope, $location, client, backbone, utils) {
		console.log('route::login');
		var u = utils, store = client.store, sa = function(f) { return utils.safeApply($scope,f);};
		$scope.user = {username:undefined, password:undefined};
		$scope.selectUser = function(user) { $scope.user.username = user; };
		$scope.backToLogin = function() {	delete $scope.user.username; delete $scope.user.password;};
		// this gets called when the form is submitted
		$scope.doSubmit = function() {
			console.log('logging in ', $scope.user.username, $scope.user.password);
			store.login($scope.user.username, $scope.user.password).then(function() {
				u.debug('login okay!');
				// sa($scope.backToLogin);
				sa(function() { $location.path('/apps'); });
			}).fail(function() {
				sa(function() {
					delete $scope.user.password;
					u.shake($($scope.el).find('input:password').parents('.password-dialog'));
				});
			});
		};
		store.getUserList()
			.then(function(result) {  sa(function() { $scope.users = result; }); })
			.fail(function(err) { u.error(err); });
	}).controller('AppsList', function($scope, $location, client, utils) {
		console.log('hello apps list');
		var u = utils, store = client.store, sa = function(f) { return utils.safeApply($scope,f); };
		var getAppsList = function() {
			client.store.getAppsList().then(function(apps) {
				console.log('got apps list', apps);
				sa(function() { $scope.apps = apps; });
			}).fail(function() {
				sa(function() { delete $scope.apps; });
				u.error('oops can\'t get apps - not ready i guess');
			});
		};
		getAppsList();
	}).controller('main', function($location, $scope, client, utils) {
		var u = utils;
		// we want to route
		client.store.on('login', function() {
			console.log('trigger login');
			// just route
			u.safeApply($scope,function() { $location.path('/apps'); });
		});
		client.store.on('logout', function() {
			console.log('trigger logout');
			// route back to login
			u.safeApply($scope,function() { $location.path('/login'); });
		});

		// this code watches for manual route changes, eg if someone goes
		// and changes the path in their browser in a way that doesn't force
		// a refresh.  here, we check to see if we're logged in, and if we are
		// we proceed to the desired target; otherwise, we merely
		$scope.$on('$routeChangeStart', function(evt, targetTemplate, sourceTemplate) {
			var requiresLogin = !targetTemplate.$$route || targetTemplate.$$route.requireslogin;
			client.store.checkLogin().then(function(login) {
				console.log('check login -->', login)
				if (!login.is_authenticated && requiresLogin) {
					console.log('not authenticated --> routing to login')
					return u.safeApply($scope, function() { $location.path('/login'); });
				} else if (login.is_authenticated && !requiresLogin) { // TODO: what's this for?
					return u.safeApply($scope, function() { $location.path('/apps'); });
				}
			});
		});

		client.store.checkLogin().then(function(login) {
			if (login.is_authenticated) {
				u.safeApply($scope, function() { $location.path('/apps'); });
			} else {
				console.log('routing to login');
				u.safeApply($scope, function() { $location.path('/login'); });
			}
		});

	}).controller('BoxesList', function($location, $scope, client, utils) {
		var u = utils,store = client.store, sa = function(f) { return utils.safeApply($scope,f); };
		var getBoxesList = function() {
			store.getBoxList().then(function (boxes) {
				console.log('boxes --> ', boxes);
				sa(function() { $scope.boxes = boxes; });
			}).fail(function() {
				sa(function() { delete $scope.boxes; });
				u.error('oops can\'t get boxes - not ready i guess');
			});
		};
		store.on('login', getBoxesList);
		getBoxesList();
		$scope.createNewBox = false;
	}).directive('focusOnShow', function() {
		return {
			restrict:'A',
			controller:function($scope, $element, $attrs, $route, client, $location) {
				$scope.$watch($attrs['focusOnShow'], function() {
					if ($scope.$eval($attrs['focusOnShow'])) {
						// 100ms after transition
						setTimeout(function() { $element.focus(); }, 100);
					}
				});
			}
		};
	});
})();
// .directive('boxeslist',function() {
// 		return {
// 			restrict: 'E',
// 			replace: true,
// 			templateUrl: 'templates/boxeslist.html',
// 			link:function ($scope, $element) { $scope.el = $element;	},
// 			controller: function ($scope, client, utils) {
// 				var u = utils,
// 					store = client.store,
// 					sa = function(f) { return utils.safeApply($scope,f); };
// 				var getBoxesList = function() {
// 					store.getBoxList().then(function (boxes) {
// 						console.log('boxes --> ', boxes);
// 						sa(function() { $scope.boxes = boxes; });
// 					}).fail(function() {
// 						sa(function() { delete $scope.boxes; });
// 						u.error('oops can\'t get boxes - not ready i guess');
// 					});
// 				};

// 				store.on('login', getBoxesList);
// 				getBoxesList();
// 				$scope.createNewBox = false;
// 			}
// 		};
// 	})