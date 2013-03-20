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
			u: WebBox,
			username: undefined,
			box : undefined,
			boxlist: [],
			loading: 0,
			is_logged_in : function() { return $scope.username !== undefined; },
			not_logged_in : "<i>not logged in</i>"
		});

		console.log("$scope is ", $scope);

		_($scope).map(function(val,k) {
			// hook up scope to model changes
			u.log('HOOKING UP EVENTS ', k);
			$scope.$watch(k, function() { event_model.trigger('change:'+k, $scope[k]); });
		});

		$scope.cb_login_logout_clicked = function() {
			if ($scope.is_logged_in()) {
				// pull up logout dialog // TODO make this more angular
				console.log('is logged in, so log out');
				$('#webbox_toolbar .logout').modal({ show: true });
			} else {
				console.log('not logged in, so log in');				
				// pull up login dialog // TODO make this more angular!
				$('#webbox_toolbar .login').modal({ show: true });
			}
		};

		var update_boxlist = function() {
			// get boxes
			var this_ = this, d = u.deferred();
			store.fetch().then(function(boxlist) {
				apply(function() {
					$scope.boxlist = boxlist.map(function() { return boxlist.get_id(); });
				});
			});
			return d.promise();
		};

		$scope.login = function(username) {
			$scope.username = username;
		};
		
		$scope.logout = function() {
			delete $scope.username;
			delete $scope.box;
		};

		$scope._initialize = function() {
			store.on('login', function(username) {
				u.debug('toolbar :: login ');
				apply(function() { $scope.username = username;  });
			}).on('logout', function(username) {
				u.debug('toolbar :: logout ');				
				apply(function() { $scope.logout(); });
			}).on('change:boxes', function() {
				u.debug('toolbar :: change boxes ');
				apply(function() { update_boxlist(); });
			}).on('change:selected-box', function(bid) {
				apply(function() { $scope.box = bid; });
			});
			
			// check to see if already logged in 
			store.checkLogin().then(function(response) {
				if (response.is_authenticated) {
					apply(function() { $scope.login(response.user);	});
					update_boxlist();					
				} else {
					apply(function() { $scope.logout();	});
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
