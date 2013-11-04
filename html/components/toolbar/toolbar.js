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
				$element.find('#login-dialog').on('shown.bs.modal', function() {
					$element.find('#login-username').focus();
				});
				$element.find('#logout-dialog').on('shown.bs.modal', function() { 
					$element.find('#logout-ok').focus();
				});
			},
			scope: { box:"=boxVar", user:"=usernameVar" },
			controller: function($scope, client, backbone, utils) {
				var u = utils;
				var toolbar = {}; // public interface
				
				var model = new Backbone.Model({visible:true});
				var apply = function(fn) { return utils.safe_apply($scope, fn); };
				var login_dialog = function() { return $($scope.el).find('#login-dialog'); }
				var logout_dialog = function() { return $($scope.el).find('#logout-dialog'); }
				var getStore = function() {	return client.store;};
				var new_box_dialog = function() { return $($scope.el).find('#new-box-dialog'); }
				
				toolbar.on = function(msg, fn) {  return model.on(msg,fn); };
				toolbar.off = function(msg, fn) {  return model.off(msg,fn); };
				toolbar.setVisible = function(b) { model.set('visible', b); };
				toolbar.get_selected_box = function() { return; };

				var get_last_used_box = function() {
					return localStorage["indx__last_used_box::" + document.location.toString()];
				};
				var clear_last_used_box = function() {
					delete localStorage["indx__last_used_box::" + document.location.toString()];
				};
				var set_last_used_box = function(bid) {
					localStorage["indx__last_used_box::" + document.location.toString()] = bid;
				};				

				_($scope).extend({
					visible: true,
					u: utils,
					error:undefined,
					boxlist: [],
					loading: 0,
					_login_username:undefined,
					_login_password:undefined,
					is_logged_in : function() { return $scope.user !== undefined; },
				});

				// reflect everything in to the model >> 
				_($scope).map(function(val,k) {
					// hook up scope to model changes
					$scope.$watch(k, function() { model.trigger('change:'+k, $scope[k]); });
				});

				$scope.usericon = "<div class='glyphicon glyphicon-user'></div>"; // TODO.
				$scope.caret = "<span class='caret'></span>";
				
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
				$scope.cb_new_box_clicked = function() {
					new_box_dialog().modal({ show: true, keyboard:true });
					new_box_dialog().on('shown', function() { new_box_dialog().find('.btn-primary').focus(); });
				};
				
				var update_boxlist = function() {
					// get boxes
					var this_ = this, d = u.deferred();
					$scope.incr_loading();
					getStore().get_box_list().then(function(boxlist) {
						apply(function() {
							$scope.boxlist = boxlist.concat("create new box");
							if ($scope.box === undefined && $scope.boxlist.length > 1 && get_last_used_box()) {
								if ($scope.boxlist.indexOf( get_last_used_box() ) >= 0) {
									$scope.cb_box_selected(get_last_used_box());
								} else {
									clear_last_used_box(); 
									// don't do anything --
								}
							}
							$scope.decr_loading();
						});
					});
					return d.promise();
				};
				
				$scope.set_error = function(err) {$scope.error = err;  };
				$scope.loginbox_try_login = function(username,password) {
					$scope.incr_loading();
					getStore().login(username,password).then(function(user) {
						apply(function() {
							$scope.decr_loading();
							login_dialog().modal('hide');
							$scope.set_error();
							$scope._login_username = '';
							$scope._login_password = '';
							$scope.cb_login(user);
						});
					}).fail(function(err) {
						console.error('login failed!',err);
						apply(function() {
							$scope.decr_loading();
							$scope.set_error('username/password incorrect');
						});
					});
				};
				$scope.cb_box_selected = function(bid) {
					if (bid === $scope.boxlist[$scope.boxlist.length-1]) {
						// console.log("create new box selected ");
						$scope.cb_new_box_clicked(); // TODO get new_bid from user
					} else {
						$scope.box = bid;
						set_last_used_box(bid); 
					}
				};
				$scope.create_new_box = function(new_bid) {
					getStore().create_box(new_bid).then(function() {
						$scope.box = new_bid;
						set_last_used_box(new_bid);
						update_boxlist();
					});
				};
				$scope.cb_login = function(user) {
					$scope.user = user;
					update_boxlist();
					model.trigger('login', user);
				};		
				$scope.cb_logout = function() {
					delete $scope.user;
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
					store.check_login().then(function(user) {
						if (user.is_authenticated) {
							apply(function() { $scope.cb_login(user);	});
						} else {
							apply(function() { $scope.cb_logout();	});
						}
					});
				};
				var bind_store_listeners = function() {
					var store = getStore();
					store.on('login', function(user) {
						// u.debug('store -> toolbar :: login ');
						apply(function() { $scope.cb_login(user); });
					}).on('logout', function(username) {
						// u.debug('store -> toolbar :: logout ');				
						apply(function() { $scope.cb_logout(); });
					}).on('change:boxes', function() {
						// u.debug('store -> toolbar :: change boxes ');
						apply(function() { update_boxlist(); });
					});
					checkLogin();
				};

				model.on('change:store', bind_store_listeners);				
				model.on('change:visible',function(b) {
					apply(function() { $scope.visible = model.get('visible');  });
				});

				bind_store_listeners();
								
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

		
