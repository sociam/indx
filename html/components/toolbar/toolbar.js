/** toolbar */ 
define(['js/utils', 'text!components/toolbar/t_template.html'], function(u,t_templ) {
	console.log('toolbar --', t_templ);
	var ToolbarView = Backbone.View.extend({
		initialize:function(options) {
			
		},
		first_render:function() {
			var store = this.options.store;
			var this_ = this;
			this.$el.html(t_templ).addClass('toolbar');
			store.on('login', function(username) { this_.username = username; this_.render(); });
			store.on('logout', function(username) { delete this_.username; this_.render(); });
			store.checkLogin().then(function(response) {
				console.log('response >> ', response);
				if (response.is_authenticated) {
					console.log('authenticated - as user ', response.user);
					this_.username = response.user; this_.render(); 
				} else {
					console.log('not authenticated ', response.user);
					delete this_.username; this_.render();
				}
			});			
		},
		render:function() {
			if (!this.$el.hasClass('toolbar')) {
				this.first_render();
			}
			if (this.username) {
				this.$el.find('.username a').html(this.username);
			} else {
				this.$el.find('.username a').html('<i>not logged in</i>');
			}
			return this;
		}
	});
	
	var init = function(component, store) {
		var tv = new ToolbarView({el:component, store:store});
		tv.render();
	};
	
	return { init:init };
});
