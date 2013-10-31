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
				var apply = function(fn) { return utils.safeApply($scope, fn); };
				var loginDialog = function() { return $($scope.el).find('#login-dialog'); }
				var logoutDialog = function() { return $($scope.el).find('#logout-dialog'); }
				var getStore = function() {	return client.store;};
				var newBoxDialog = function() { return $($scope.el).find('#new-box-dialog'); }
				
				toolbar.on = function(msg, fn) {  return model.on(msg,fn); };
				toolbar.off = function(msg, fn) {  return model.off(msg,fn); };
				toolbar.setVisible = function(b) { model.set('visible', b); };
				toolbar.getSelectedBox = function() { return; };

				var getLastUsedBox = function() {
					return localStorage["indx__lastUsedBox::" + document.location.toString()];
				};
				var clearLastUsedBox = function() {
					delete localStorage["indx__lastUsedBox::" + document.location.toString()];
				};
				var setLastUsedBox = function(bid) {
					localStorage["indx__lastUsedBox::" + document.location.toString()] = bid;
				};				

				_($scope).extend({
					visible: true,
					u: utils,
					error:undefined,
					boxlist: [],
					loading: 0,
					_loginUsername:undefined,
					_loginPassword:undefined,
					isLoggedIn : function() { return $scope.user !== undefined; },
				});

				// reflect everything in to the model >> 
				_($scope).map(function(val,k) {
					// hook up scope to model changes
					$scope.$watch(k, function() { model.trigger('change:'+k, $scope[k]); });
				});

				$scope.usericon = "<div class='glyphicon glyphicon-user'></div>"; // TODO.
				$scope.caret = "<span class='caret'></span>";
				
				$scope.incrLoading = function () {	$scope.loading++; };
				$scope.decrLoading = function () {	$scope.loading = Math.max(0,$scope.loading-1); };
				
				toolbar.getSelectedBox = function() { return  $scope.box; };
				toolbar.isLoggedIn = function() { return $scope.isLoggedIn(); };

				$scope.cbLoginClicked = function() {
					loginDialog().modal({ show: true, keyboard:true });
					loginDialog().on('shown', function() { loginDialog().find('.loginUsername').focus(); });
				};
				$scope.cbLogoutClicked = function() {
					logoutDialog().modal({ show: true, keyboard:true });
					logoutDialog().on('shown', function() { logoutDialog().find('.btn-primary').focus(); });
				}; 
				$scope.cbNewBoxClicked = function() {
					newBoxDialog().modal({ show: true, keyboard:true });
					newBoxDialog().on('shown', function() { newBoxDialog().find('.btn-primary').focus(); });
				};
				
				var updateBoxlist = function() {
					// get boxes
					var this_ = this, d = u.deferred();
					$scope.incrLoading();
					getStore().getBoxList().then(function(boxlist) {
						console.log('boxlist >> ', boxlist);
						apply(function() {
							$scope.boxlist = boxlist.concat("create new box");
							if ($scope.box === undefined && $scope.boxlist.length > 1 && getLastUsedBox()) {
								if ($scope.boxlist.indexOf( getLastUsedBox() ) >= 0) {
									$scope.cbBoxSelected(getLastUsedBox());
								} else {
									clearLastUsedBox(); 
									// don't do anything --
								}
							}
							$scope.decrLoading();
						});
					});
					return d.promise();
				};
				
				$scope.setError = function(err) {$scope.error = err;  };
				$scope.loginboxTryLogin = function(username,password) {
					console.log('loginbox try login ' ,username, password);

					$scope.incrLoading();
					getStore().login(username,password).then(function(user) {
						console.log('log in complete!',username, password);
						apply(function() {
							$scope.decrLoading();
							loginDialog().modal('hide');
							$scope.setError();
							$scope._loginUsername = '';
							$scope._loginPassword = '';
							$scope.cbLogin(user);
						});
					}).fail(function(err) {
						console.error('login failed!',err);
						apply(function() {
							$scope.decrLoading();
							$scope.setError('username/password incorrect');
						});
					});
				};		
				$scope.cbBoxSelected = function(bid) {
					if (bid === $scope.boxlist[$scope.boxlist.length-1]) {
						console.log("create new box selected ");
						$scope.cbNewBoxClicked(); // TODO get newBid from user
					} else {
						$scope.box = bid;
						setLastUsedBox(bid); 
					}
				};
				$scope.createNewBox = function(newBid) {
					getStore().createBox(newBid).then(function() {
						$scope.box = newBid;
						setLastUsedBox(newBid);
						updateBoxlist();
					});
				};
				$scope.cbLogin = function(user) {
					$scope.user = user;
					updateBoxlist();
					model.trigger('login', user);
				};		
				$scope.cbLogout = function() {
					delete $scope.user;
					delete $scope.box;
					$scope.boxlist = [];
					model.trigger('logout');			
				};
				$scope.doLogout = function() {
					getStore().logout();
					$scope.cbLogout(); 
				};
				var checkLogin = function() {
					var store = getStore();					
					store.checkLogin().then(function(user) {
						if (user.is_authenticated) {
							apply(function() { $scope.cbLogin(user);	});
						} else {
							apply(function() { $scope.cbLogout();	});
						}
					});
				};
				var bindStoreListeners = function() {
					var store = getStore();
					store.on('login', function(user) {
						u.debug('store -> toolbar :: login ');
						apply(function() { $scope.cbLogin(user); });
					}).on('logout', function(username) {
						u.debug('store -> toolbar :: logout ');				
						apply(function() { $scope.cbLogout(); });
					}).on('change:boxes', function() {
						u.debug('store -> toolbar :: change boxes ');
						apply(function() { updateBoxlist(); });
					});
					checkLogin();
				};

				model.on('change:store', bindStoreListeners);				
				model.on('change:visible',function(b) {
					apply(function() { $scope.visible = model.get('visible');  });
				});

				bindStoreListeners();
								
				// totally not necessary anymore: 
				// var domEl = $('<div></div>').addClass('toolbar').prependTo('body');			
				// $(domEl).append(templates.main.template);
				// var app = angular.module('WebboxToolbar', []);
				// app.controller('ToolbarController', ToolbarController);
				// angular.bootstrap(domEl, ["WebboxToolbar"]);
				return toolbar;
			}
		};
	});

		
