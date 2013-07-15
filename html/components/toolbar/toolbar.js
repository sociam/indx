/*global $,_,document,window,console,escape,Backbone */
/*jslint vars:true, todo:true, sloppy:true */
angular
	.module('indx')
	.directive('toolbar',function() {
		return {
			restrict:'E',
			replace:true,
			templateUrl:'/components/toolbar/toolbar.html',
			link:function($scope, $element) {
				$scope.el = $element;
			},
			scope: { box:"=boxVar", username:"=usernameVar" },
			controller: function($scope, client, backbone, utils) {
				var u = utils;
				var toolbar = {}; // public interface
				
				var model = new Backbone.Model({visible:true});
				var apply = function(fn) { return utils.safe_apply($scope, fn); };
				var login_dialog = function() { return $($scope.el).find('.login_dialog'); }
				var logout_dialog = function() { return $($scope.el).find('.logout_dialog'); }
				var getStore = function() {
					// TODO ! 
					return client.store;
				};
				
				toolbar.on = function(msg, fn) {  return model.on(msg,fn); };
				toolbar.off = function(msg, fn) {  return model.off(msg,fn); };
				toolbar.setVisible = function(b) { model.set('visible', b); };
				toolbar.get_selected_box = function() { return; };
				toolbar.is_logged_in = function() { return false; };

				_($scope).extend({
					visible: true,
					u: utils,
					error:undefined,
					boxlist: [],
					loading: 0,
					_login_username:undefined,
					_login_password:undefined,
					is_logged_in : function() { return $scope.username !== undefined; },
				});
				
				_($scope).map(function(val,k) {
					// hook up scope to model changes
					$scope.$watch(k, function() { model.trigger('change:'+k, $scope[k]); });
				});
				
				$scope.incr_loading = function () {	$scope.loading++; };
				$scope.decr_loading = function () {	$scope.loading = Math.max(0,$scope.loading-1); };
				
				toolbar.get_selected_box = function() { return  $scope.box; };
				toolbar.is_logged_in = function() { return $scope.is_logged_in(); };
				
				$scope.cb_login_clicked = function() {
					login_dialog().modal({ show: true, keyboard:true });
					login_dialog().on('shown', function() { login_dialog().find('.login_username').focus(); });
				};
				$scope.cb_logout_clicked = function() {
					logout_dialog().modal({ show: true, keyboard:true });
					logout_dialog().on('shown', function() { logout_dialog().find('.btn-primary').focus(); });
				}; 
				
				var update_boxlist = function() {
					// get boxes
					var this_ = this, d = u.deferred();
					$scope.incr_loading();
					getStore().fetch().then(function(boxlist) {
						apply(function() {
							$scope.boxlist = boxlist.map(function(b) { return b.get_id(); });
							if ($scope.box === undefined && $scope.boxlist.length > 0) {
								$scope.cb_box_selected($scope.boxlist[0]);
							}
							$scope.decr_loading();
						});
					});
					return d.promise();
				};
				
				$scope.set_error = function(err) {$scope.error = err;  };
				$scope.loginbox_try_login = function(username,password) {
					console.log('loginbox try login ' ,username, password);
					$scope.incr_loading();
					getStore().login(username,password).then(function() {
						console.log('worked!',username, password);
						apply(function() { 
							$scope.decr_loading();				
							login_dialog().modal('hide');
							$scope.set_error();
							$scope._login_username = '';
							$scope._login_password = '';
							$scope.cb_login(username);													
						});
					}).fail(function(err) {
						console.error('login failed!',err);						
						apply(function() {
							$scope.decr_loading();
							$scope.set_error('username/password incorrect');
						});
					});
				};		
				$scope.cb_box_selected = function(bid) { $scope.box = bid;	};
				$scope.cb_login = function(username) {
					$scope.username = username;
					update_boxlist();
					model.trigger('login', username);
				};		
				$scope.cb_logout = function() {
					delete $scope.username;
					delete $scope.box;
					$scope.boxlist = [];
					model.trigger('logout');			
				};
				$scope.do_logout = function() {
					getStore().logout();
					$scope.cb_logout();
				};
				var checkLogin = function() {
					var store = getStore();					
					store.check_login().then(function(response) {
						u.debug('checklogin ', response);
						if (response.is_authenticated) {
							apply(function() { $scope.cb_login(response.user);	});
						} else {
							apply(function() { $scope.cb_logout();	});
						}
					});
				};
				model.on('change:store', function() {
					var store = getStore();
					store.on('login', function(username) {
						u.debug('store -> toolbar :: login ');
						apply(function() { $scope.cb_login(username); });
					}).on('logout', function(username) {
						u.debug('store -> toolbar :: logout ');				
						apply(function() { $scope.cb_logout(); });
					}).on('change:boxes', function() {
						u.debug('store -> toolbar :: change boxes ');
						apply(function() { update_boxlist(); });
					});
					checkLogin();
				});
				
				model.on('change:visible',function(b) {
					apply(function() { $scope.visible = model.get('visible');  });
				});
				
				checkLogin();
				
				// totally not necessary anymore: 
				// var dom_el = $('<div></div>').addClass('toolbar').prependTo('body');			
				// $(dom_el).append(templates.main.template);
				// var app = angular.module('WebboxToolbar', []);
				// app.controller('ToolbarController', ToolbarController);
				// angular.bootstrap(dom_el, ["WebboxToolbar"]);
				return toolbar;
			}
		};
	});

		
