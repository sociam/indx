
/** toolbar */ 
define(['js/utils', 'text!components/toolbar/t_template.html', 'text!components/toolbar/login_template.html'], function(u,t_templ,l_templ) {
	console.log('toolbar --', t_templ);
	var ToolbarView = Backbone.View.extend({
		tagClass:"div",
		events: {
			'click .boxlist a' : '_box_selected'
		},
		initialize:function(options) {},
		first_render:function() {
			var store = this.options.store;
			var this_ = this; 
			this.$el.html(t_templ).addClass('toolbar navbar-fixed-top navbar');
			store.on('login', function(username) {
				// console.log('login');
				this_.username = username; this_.render();
				this_.trigger('login', username);
			});
			store.on('logout', function(username) {
				// console.log('logout');
				this_.set_selected_box(); // clear selected box
				delete this_.username; this_.render();
				this_.trigger('logout');				
			});
			store.checkLogin().then(function(response) {
				// console.log('response >> ', response);
				if (response.is_authenticated) {
					// console.log('authenticated - as user ', response.user);
					this_.username = response.user;
					this_.trigger('login', response.user);					
				} else {
					// console.log('not authenticated ', response.user);
					delete this_.username;
					this_.trigger('logout');
				}
				this_._post_login_setup(store);
			});
			// console.log('appending ', l_templ);
			$('body').append(this.$el);
			$('body').append(l_templ);
			$('#login_dialog .loginbtn').click(function() {
				var username = $('#login_dialog .username_field').val();
				var password = $('#login_dialog .password_field').val();
				store.login(username,password).then(function() {
					this_._post_login_setup(store);
				});
			});
			$('#logout_dialog .logoutbtn').click(function() {
				store.logout();
			});			
		},
		_post_login_setup:function(store) {
			// get boxes
			var this_ = this;
			store.list_boxes().then(function(boxes) {
				// console.log('list_boxes', boxes);
				var boxlist = boxes.list;
				$('.boxlist').children().remove();
				boxlist.map(function(box) {
					$('.boxlist').append(_('<li><a data-id="<%= id %>" href="#"><%= id %></a></li>').template({id:box}));
				});
				this_.render();				
			});
		},
		set_selected_box:function(b) {
			this.trigger('change:box', b);
			if (b === undefined) {
				$('.selected-box').html(' no box selected ');
			} else {
				$('.selected-box').html(b);
			}
			this.selected_box = b;
		},
		_box_selected:function(d) {
			this.set_selected_box($(d.currentTarget).attr('data-id'));
		},
		render:function() {
			if (!this.$el.hasClass('toolbar')) {
				this.first_render();
			}
			if (this.username) {
				console.log('username - login');
				this.$el.find('.username_display a').html(this.username);
				this.$el.find('.username_display').show();
				this.$el.find('.login_display').hide();				
			} else {
				console.log('no username - logout');
				this.$el.find('.username_display').hide();
				this.$el.find('.login_display').show();				
			}
			return this;
		}
	});
	
	var init = function(store) {
		var tv = new ToolbarView({store:store});
		tv.render();
		return tv;
	};
	
	return { init:init };
});
