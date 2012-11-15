//
// saveface APP --
// simple app logic for saveface application
// see js/fb.js for low-level data scrobbling

define(['plugins/js/fb','js/models','js/utils'],function(fb,models,u) {

	var Router = Backbone.Router.extend({
		routes: {
			'login' : 'login',
			'store' : 'store',
			'denied' : 'denied',
			'': 'start',
		},
		initialize:function(options) {
			console.log('router initialize >> ', options.graph && options.graph.id);
			this.graph = options.graph;
		},
		init_controls:function() {
			var graph = this.graph || models.get_graph('facebook');;
			_(fb.actions).map(function(action, mode) {
				$('#'+mode)
					.attr("disabled",false)
					.on("click", function() {
						var this_ = this;
						console.log('click on ', mode, ' using graph ', graph.id);
						$(this_).attr('disabled',true);
						fb.exec_action(graph,action).then(function() {
							console.log('done with action > saving graph ', mode);
							graph.save().then(function() {
								console.log('graph save successful.');
								$(this_).attr('disabled',false);
							}).fail(function(err) {
								console.error('graph save unsuccessful.', err);
							});
						}).fail(function(err) {
							console.error('FAIL on action ', mode, err);
						});
					});
			});			
		},
		start:function() {
			console.log('>> mode start--');
			var this_ = this;
			FB.getLoginStatus(function(response) {
				if (response.status === 'connected') {
					// connected
					console.log('connected -- proceeding to navigate ');
					this_.init_controls();
					this_.nav('store');
				} else { // if (response.status === 'not_authorized') {
					this_.nav('login');
				} 
			});			
		},
		login:function() {
			console.log('>> mode login --');
			var this_ = this;
			$('.box').not('.login').fadeOut('slow', function(){ $('.login').fadeIn(); });
		},
		store:function() {
			console.log('>> mode store --');
			var this_ = this;
			FB.getLoginStatus(function(response) {
				if (response.status === 'connected') { this_.init_controls();} else { this_.nav(''); }
			});
			$('.box').not('.controls').fadeOut('slow', function() { $('.controls').fadeIn('slow');  });
		},
		denied:function() {
			console.log('>> mode denied --');
			var this_ = this;
			$('.box').not('.denied').fadeOut('slow', function() { $('.denied').fadeIn();  });
		},
		nav:function(state) {
			this.navigate(state, {trigger:true});
		}
	});
	
	var init = function(graph) {
		var _router = (new Router(graph));		
		$('#login').on('click', function() {
			FB.login(function(resp) {
				if (resp.authResponse) { _router.nav('store'); } else { _router.nav('/denied');	}
			}, { perms:'read_stream,read_mailbox,offline_access'});
		});	
		$('#logoff').click('click', function() {
			console.log('logging out');
			FB.logout(); _router.nav('login');
		});
		Backbone.history.start({root:document.location.pathname});
	};
	
	return { init : init };	
});
