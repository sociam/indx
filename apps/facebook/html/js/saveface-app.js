/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true, sloppy:true */

//
// 
// demo saveface webbox app --
// simple app logic for saveface application
// see js/fb.js for low-level data scrobbling
//
// 
define(['js/saveface-grab'],function(fb) {
	var u = WebBox.utils;
	var switchTo = function(toshow) {
		console.log("SWITCH TO ", toshow, $('.box').not(toshow).length, $('.modes ' + toshow).length);
		$('#modes .box').not(toshow).hide('slow', function() {
			$('#modes ' + toshow).fadeIn();
		});
	};
	var Router = Backbone.Router.extend({
		routes: {
			'save' : 'save',
			'denied' : 'denied',
			'start' : 'start',			
			'' : 'start'
		},
		initialize:function(options) {
			console.log('router initialize >> ', options.graph && options.graph.id);
			this.graph = options.graph;
			var graph = this.graph || models.getGraph('facebook');
			_(fb.actions).map(function(action, mode) {
				$('#'+mode)
					.attr("disabled",false)
					.on("click", function() {
						var this_ = this;
						u.log('click on ', mode, ' using graph ', graph.id);
						$(this_).attr('disabled',true);
						fb.execAction(graph,action).then(function() {
							console.log('done with action > saving graph ', mode);
							graph.save().then(function() {
								u.log('graph save successful.');
								$(this_).attr('disabled',false);
							}).fail(function(err) {
								u.error('graph save unsuccessful.', err);
							});
						}).fail(function(err) {
							u.error('FAIL on action ', mode, err);
						});
					});
			});			
		},
		start:function() {
			var router = this;			
			FB.getLoginStatus(function(response) {
				if (response.status === 'connected') {
					// everything is OK, let's save
					u.log('FBLoginStatus:connected ');
					router.nav('save');
				} else if (response.status === 'not_authorized') {
					u.log('FBLoginStatus:notauthorised');					
					router.nav('denied');
				} else {
					u.log('FBLoginStatus:notloggedin');										
					// not logged into facebook, so let's help them there
					switchTo('.startbox');
				}
			});			
		},
		save:function() {
			switchTo('.controls');
		},
		denied:function() {
			switchTo('.denied');
		},
		nav:function(state) {
			this.navigate(state, {trigger:true});
		}
	});
	
	
	var init = function(graph) {
		var router = window.router = (new Router({graph: graph}));
		$('#loginbtn').on('click', function() {
			FB.login(function(response) {
				console.log("FB login resp ", response);
				if (response.authResponse) { router.nav('save'); } else {
					router.nav('start');
				}
			}, { perms:'read_stream,read_mailbox,offline_access'});
		});		
		$('#logoff').click('click', function() {
			console.log('logging out');
			fb.watcher.reset();
			FB.logout(function() {	router.nav('start');});
		});		
		Backbone.history.start({root:document.location.pathname});
		router.graph = graph; 
		router.nav('start');
		return router;
	};	
	return { init : init };
});
