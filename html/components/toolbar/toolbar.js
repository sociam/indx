/*global $,_,document,window,console,escape,Backbone */
/*jslint vars:true, todo:true, sloppy:true */
angular
	.module('webbox')
	.factory('toolbar',function(utils) {
		var u = utils, templates;
		var toolbar_exports = {};
		var event_model = new Backbone.Model({visible:true});
		// TODO :: move safe-apply somewhere
		var safe_apply = function($scope, fn) {
			if ($scope.$$phase) { return fn(); }
			$scope.$apply(fn);
		};
		toolbar_exports.on = function(msg, fn) {  return event_model.on(msg,fn); };
		toolbar_exports.off = function(msg, fn) {  return event_model.off(msg,fn); };
		toolbar_exports.setVisible = function(b) { event_model.set('visible', b); };
		toolbar_exports.setStore = function(s) { event_model.set('store', s);	};
		toolbar_exports.get_selected_box = function() { return; };
		toolbar_exports.is_logged_in = function() { return false; };				
		var getStore = function() { return event_model.get('store'); };
		var ToolbarController = function($scope) {				
			var apply = function(fn) { return safe_apply($scope, fn); };				
			_($scope).extend({
				visible: true,
				u: utils,
				error:undefined,
				username: undefined,
				box : undefined, // selected box
				boxlist: [],
				loading: 0,
				_login_username:undefined,
				_login_password:undefined,
				is_logged_in : function() { return $scope.username !== undefined; },
				not_logged_in : "<i>log in to webbox</i>"
			});
			_($scope).map(function(val,k) {
				// hook up scope to model changes
				$scope.$watch(k, function() { event_model.trigger('change:'+k, $scope[k]); });
			});
			$scope.incr_loading = function () {	$scope.loading++; };
			$scope.decr_loading = function () {	$scope.loading--; };
			var apply_incr_loading = function () {	apply($scope.incr_loading); };
			var apply_decr_loading = function () {	apply($scope.decr_loading); };
			toolbar_exports.get_selected_box = function() { return  $scope.box; };
			toolbar_exports.is_logged_in = function() { return $scope.is_logged_in(); };	
			$scope.cb_login_logout_clicked = function() {
				if ($scope.is_logged_in()) {
					// pull up logout dialog // TODO make this more angular
					$('#logout_dialog').modal({ show: true, keyboard:true });
				} else {
					$('#login_dialog').modal({ show: true, keyboard:true });
				}
				return false;
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
			$scope.set_error = function(err) {
				$scope.error = err;
			};
			$scope.loginbox_try_login = function(username,password) {
				$scope.incr_loading();
				getStore().login(username,password).then(function() {
					$scope.decr_loading();				
					$('#login_dialog').modal('hide');
					setTimeout(function() {
						$scope.set_error();
						$scope._login_username = '';
						$scope._login_password = '';
					}, 1000);
				}).fail(function() {
					apply(function() {
						$scope.decr_loading();
						$scope.set_error('username/password incorrect');
					});
				});
			};				
			$scope.cb_box_selected = function(bid) { $scope.box = bid;	};
			$scope.cb_login = function(username) {
				$scope.username = username;
				$scope.username_html = username + " &nbsp; <i class='icon-user'></i>";
				update_boxlist();
				event_model.trigger('login', username);
			};		
			$scope.cb_logout = function() {
				delete $scope.username;
				delete $scope.username_html;
				delete $scope.box;
				$scope.boxlist = [];
				event_model.trigger('logout');			
			};
			$scope.do_logout = function() {
				console.log('do logout');
				getStore().logout();
			};		
			event_model.on('change:store', function() {
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
				store.checkLogin().then(function(response) {
					u.debug('checklogin ', response);
					if (response.is_authenticated) {
						apply(function() { $scope.cb_login(response.user);	});
					} else {
						apply(function() { $scope.cb_logout();	});
					}
				});						
			});
			event_model.on('change:visible',function(b) {
				apply(function() { $scope.visible = event_model.get('visible');  });
			});
		};
		var load_templates = function() {
			templates = {
				main: { url: '/components/toolbar/t_template.html' }
			};			
			return $.when.apply($, _(templates).keys().map(function(tname) {
				var d = new $.Deferred();
				$.get(templates[tname].url).then(function(t) {
					templates[tname].template = t;
					d.resolve(t);
				});
				return d.promise();
			})).promise();
		};		
		toolbar_exports.load = (function() {
			utils.log('Toolbar loading >> ');
			var this_ = this, d = utils.deferred();
			load_templates().then(function() {
				var dom_el = $('<div></div>').addClass('toolbar').prependTo('body');			
				$(dom_el).append(templates.main.template);
				var app = angular.module('WebboxToolbar', []);
				app.controller('ToolbarController', ToolbarController);
				angular.bootstrap(dom_el, ["WebboxToolbar"]);
				$("#login_dialog, #logout_dialog").on('shown', function() {	$(this).find("[autofocus]:first").focus();	});
				d.resolve();
			}).fail(d.reject);
			return d;
		});
		return toolbar_exports;
	});
