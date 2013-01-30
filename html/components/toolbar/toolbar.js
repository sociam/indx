/*global $,_,document,window,console,escape,Backbone,exports,require,assert,define,u */
/*jslint vars:true, todo:true, sloppy:true */

var root = this, WebBox;
// The top-level namespace
if (typeof exports !== 'undefined'){ WebBox = exports.WebBox;	}
else { WebBox = root.WebBox; }

(function() {
	var u = WebBox.utils;
	var ToolbarView = WebBox.Toolbar = Backbone.View.extend({
		tagClass:"div",
		events: { 'click .boxlist a' : '_box_selected'	},
		initialize:function(options) {
			u.assert(this.options.store, "must pass in store");
		},
		load_templates:function () {
			var d = u.deferred(), server_url = this.options.store.get('server_url'), this_ = this;
			u.when([
				[server_url, 'components/toolbar/t_template.html'].join('/'),
				[server_url, 'components/toolbar/login_template.html'].join('/')
			].map(function(tname) {
				var d = u.deferred();
				console.log('tname ', tname);
				$.get(tname).then(function(t) {
					console.log('resolving ', t);
					d.resolve(t);
				});
				return d.promise();
			})).then(function(t1, t2) {
				console.log('OMG ', t1, t2);
				d.resolve(this_.first_render());
			});
			return d.promise();
		},
		first_render:function(t_templ,l_templ) {
			var store = this.options.store, this_ = this;
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
				this_._post_login_setup();
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
		_post_login_setup:function() {
			// get boxes
			var store = this.options.store, this_ = this;
			store.fetch().then(function() {
				var boxes = store.boxes();
				$('.boxlist').children().remove();
				boxlist.map(function(box) {
					$('.boxlist').append(_('<li><a data-id="<%= id %>" href="#"><%= id %></a></li>').template({id:box.id}));
				});
				this_.render();				
			});
		},
		set_selected_box:function(b) {
			this.trigger('change:box', b);
			$('.selected-box').html(b === undefined ? ' no box selected ' : b);
			this.selected_box = b;
		},
		_box_selected:function(d) {
			this.set_selected_box($(d.currentTarget).attr('data-id'));
		},
		_render_update:function() {
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
		},														
		render:function() {
			var this_ = this;
			if (!this.$el.hasClass('toolbar')) {
				return this.load_templates().then(function() {
					this_._render_update();
				});
			}
			this._render_update();
			return this;
		}
	});
})();
