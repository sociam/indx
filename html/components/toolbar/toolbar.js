/*global $,_,document,window,console,escape,Backbone */
/*jslint vars:true, todo:true, sloppy:true */

var root = this, WebBox;
// The top-level namespace
if (typeof exports !== 'undefined'){ WebBox = exports.WebBox;}
else { WebBox = root.WebBox; }

(function() {
	console.log("TOOLBAR LOADING >>>>> ");
	var u = WebBox.utils, templates, store;
	var toolbar_exports = WebBox.Toolbar = {};
	var event_model = new Backbone.Model();
	toolbar_exports.on = function(msg, fn) {  return event_model.on(msg,fn); };
	toolbar_exports.off = function(msg, fn) {  return event_model.off(msg,fn); };	
	
	var ToolbarController = function($scope) {
		u.log('toolbar controller!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

		var apply = function(g) { return $scope.$apply(g); };
		
		_($scope).extend({
			u: WebBox.utils,
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
			store.fetch().then(function(boxlist) {
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
			store.login(username,password).then(function() {
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
		
		$scope.cb_box_selected = function(bid) {
			console.log('box selected ', bid);
			$scope.box = bid;
			event_model.trigger('change:box', bid);
		};		
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
			store.logout();
		};

		$scope._initialise = function() {
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
			
			// check to see if already logged in 
			store.checkLogin().then(function(response) {
				u.debug('checklogin ', response);
				if (response.is_authenticated) {
					apply(function() { $scope.cb_login(response.user);	});
				} else {
					apply(function() { $scope.cb_logout();	});
				}
			});						
		};		
	};

	var load_templates = function(server_url) {
		templates = {
			main: { url: [server_url, 'components/toolbar/t_template.html'].join('/') },
			login:{ url: [server_url, 'components/toolbar/login_template.html'].join('/')}
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

	toolbar_exports.load = function(dom_el, _store, server_url) {
		var d = u.deferred();
		store = _store;
		
		
		load_templates(_store.get('server_url')).then(function() {
			$(dom_el).append(templates.main.template).append(templates.login.template);
			
			var app =  angular.module('WebboxToolbar', []);
			app.controller('ToolbarController', ToolbarController);
			angular.bootstrap(dom_el, ["WebboxToolbar"]);
			
			d.resolve();
		}).fail(d.reject);
		return d.promise();
	};

	WebBox.loader_dependencies.toolbar.dfd.resolve(toolbar_exports);	
}());
