


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
		client.store.check_login().then(function(login) {
			if (login.is_authenticated) {
				u.safe_apply($scope, function() { $location.path('/apps'); });
			} else {
				console.log('routing to login');
				u.safe_apply($scope, function() { $location.path('/login'); });
			}
		});
	}).controller('Logout', function($scope, $location, client, utils) {
		// root just redirects to appropriate places
		console.log('route::logout', client);
		try{
			client.store.logout().then(function(login) {
				try {
					utils.safe_apply($scope, function() { $location.path('/login'); });
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
		$scope.isLocalUser = function(u) { return u && (u.type == 'local_owner' || u.type == 'local_user'); };
		$scope.isOpenIDUser = function(u) { return u.type == 'openid'; };
		console.log('route::login');
		var u = utils, store = client.store, sa = function(f) { return utils.safe_apply($scope,f);};
		$scope.selected = {};
		$scope.select_user = function(user) { 
			console.log('selected user ', user);
			$scope.selected.user = user; 
			if ($scope.isOpenIDUser(user)) { $scope.do_submit(); }
		};
		$scope.set_openid_error= function(err) { $scope.openid_error = err; };
		$scope.openid_validate = function(id) {
			if (u.isValidURL(id)) { $scope.set_openid_error(''); return true; }
			$scope.set_openid_error(id && id.length > 0 ? 'Please provide an OpenID URL' : '');
			return false;
		};
		$scope.openid_select_user = function(openid_url) {
			$scope.select_user({type:'openid', '@id':openid_url})
		};
		$scope.back_to_login = function() {	delete $scope.selected.user; delete $scope.selected.password;};
		// this gets called when the form is submitted
		$scope.do_submit = function() {
			console.log('logging in ', $scope.selected.user, $scope.selected.password);
			var user = $scope.selected.user, p = $scope.selected.password;
			if ($scope.isLocalUser(user)) {
				return store.login($scope.selected.user["@id"], $scope.selected.password).then(function() {
					sa(function() { $location.path('/apps'); });
				}).fail(function() {
					sa(function() {
						delete $scope.selected.password;
						u.shake($($scope.el).find('input:password').parents('.password-dialog'));
					});
				});
			}
			if ($scope.isOpenIDUser(user)) {
				console.log('openid user');
				return store.login_openid(user["@id"]).then(function() {
					console.log('launcherjs >> openid_login success continuation ---------------- ');
					sa(function() { 
						delete $scope.openid_error; 
						$location.path('/apps'); 
					});
				}).fail(function(error) {
					console.log('launcherjs >> openid_login failure continuation ---------------- ', error);
					sa(function() {
						$scope.openid_error = error.message;
						delete $scope.selected.password;
						delete $scope.selected.user;
						u.shake($($scope.el).find('input:password').parents('.special'));
					});
				});
			}
			throw new Error("No support for openid login yet -- hold your horsies");
		};
		store.get_user_list()
			.then(function(users) {
				sa(function() {
					$scope.users = users.map(function(x) {
						if (_.isObject(x) && x["@id"]) { // latest server
							if (!x.name) { x.name = x["@id"]; }
							return x;
						}
						if (_.isString(x)) { // old server
							return {"@id": x, "name": x, "type":'local'};
						}
						console.error('unknown user type', x);
						throw new Error("Unknown user type ", x);
					});
				});
			}).fail(function(err) { u.error(err); });
	}).controller('AppsList', function($scope, $location, client, utils) {
		console.log('hello apps list');
		var u = utils, store = client.store, sa = function(f) { return utils.safe_apply($scope,f); };
		var get_apps_list = function() {
			client.store.get_apps_list().then(function(apps) {
				console.log('got apps list', apps);
				sa(function() { $scope.apps = apps; });
			}).fail(function() {
				sa(function() { delete $scope.apps; });
				u.error('oops can\'t get apps - not ready i guess');
			});
		};
		get_apps_list();
	}).controller('main', function($location, $scope, client, utils) {
		var u = utils;
		// we want to route
		client.store.on('login', function() {
			// just route
			u.safe_apply($scope,function() { $location.path('/apps'); });
		});
		client.store.on('logout', function() {
			// route back to login
			u.safe_apply($scope,function() { $location.path('/login'); });
		});

		// this code watches for manual route changes, eg if someone goes
		// and changes the path in their browser in a way that doesn't force
		// a refresh.  here, we check to see if we're logged in, and if we are
		// we proceed to the desired target; otherwise, we merely
		$scope.$on('$routeChangeStart', function(evt, target_template, source_template) {
			var requires_login = !target_template.$$route || target_template.$$route.requireslogin;
			client.store.check_login().then(function(login) {
				if (!login.is_authenticated && requires_login) {
					return u.safe_apply($scope, function() { $location.path('/login'); });
				} else if (login.is_authenticated && !requires_login) {
					return u.safe_apply($scope, function() { $location.path('/apps'); });
				}
			});
		});

		client.store.check_login().then(function(login) {
			if (login.is_authenticated) {
				u.safe_apply($scope, function() { $location.path('/apps'); });
			} else {
				console.log('routing to login');
				u.safe_apply($scope, function() { $location.path('/login'); });
			}
		});

	}).controller('BoxesList', function($location, $scope, client, utils) {
		var u = utils,store = client.store, sa = function(f) { return utils.safe_apply($scope,f); };
		var get_boxes_list = function() {
			store.get_box_list().then(function (boxes) {
				console.log('boxes --> ', boxes);
				sa(function() { $scope.boxes = boxes; });
			}).fail(function() {
				sa(function() { delete $scope.boxes; });
				u.error('oops can\'t get boxes - not ready i guess');
			});
		};
		store.on('login', get_boxes_list);
		get_boxes_list();
		$scope.create_new_box = false;
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
// 					sa = function(f) { return utils.safe_apply($scope,f); };
// 				var get_boxes_list = function() {
// 					store.get_box_list().then(function (boxes) {
// 						console.log('boxes --> ', boxes);
// 						sa(function() { $scope.boxes = boxes; });
// 					}).fail(function() {
// 						sa(function() { delete $scope.boxes; });
// 						u.error('oops can\'t get boxes - not ready i guess');
// 					});
// 				};

// 				store.on('login', get_boxes_list);
// 				get_boxes_list();
// 				$scope.create_new_box = false;
// 			}
// 		};
// 	})