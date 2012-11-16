/** toolbar */ 
define(['js/utils', 'text!components/toolbar/t_template.html', 'text!components/toolbar/login_template.html'], function(u,t_templ,l_templ) {
	console.log('toolbar --', t_templ);
	var ToolbarView = Backbone.View.extend({
		tagClass:"div",
		initialize:function(options) {
		},
		first_render:function() {
			var store = this.options.store;
			var this_ = this; 
			this.$el.html(t_templ).addClass('toolbar navbar-fixed-top navbar');
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
			console.log('appending ', l_templ);
			$('body').append(this.$el);
			$('body').append(l_templ);
			$('#login_dialog .loginbtn').click(function() {
				var username = $('#login_dialog .username_field').val();
				var password = $('#login_dialog .password_field').val();
				store.login(username,password);
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
	
	var init = function(store) {
		var tv = new ToolbarView({store:store});
		tv.render();
	};
	
	return { init:init };
});
