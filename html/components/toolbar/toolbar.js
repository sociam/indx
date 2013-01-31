/*global $,_,document,window,console,escape,Backbone */
/*jslint vars:true, todo:true, sloppy:true */

var root = this, WebBox;
// The top-level namespace
if (typeof exports !== 'undefined'){ WebBox = exports.WebBox;}
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
				$.get(tname).then(function(t) {	d.resolve(t); });
				return d.promise();
			})).then(function(t1, t2) {
				d.resolve(this_.first_render(t1,t2));
			});
			return d.promise();
		},
		first_render:function(t_templ,l_templ) {
			var store = this.options.store, this_ = this;
			this.$el.html(t_templ).addClass('toolbar navbar-fixed-top navbar');
			store.on('login', function(username) {
				this_.username = username; this_.render();
				this_.trigger('login', username);
			});
			store.on('logout', function(username) {
				this_.set_selected_box_id(); // clear selected box
				delete this_.username; this_.render();
				this_.trigger('logout');				
			});
			store.on('change:boxes', function() { this_._update_boxlist(); });
			store.on('change:selected-box', function(bid) { this_.set_selected_box_id(bid); });
			store.checkLogin().then(function(response) {
				if (response.is_authenticated) {
					this_.username = response.user;
					this_.trigger('login', response.user);					
				} else {
					delete this_.username;
					this_.trigger('logout');
				}
				this_._update_boxlist();
			});
			$('body').append(this.$el);
			$('body').append(l_templ);
			$('#login_dialog .loginbtn').click(function() {
				var username = $('#login_dialog .username_field').val();
				var password = $('#login_dialog .password_field').val();
				store.login(username,password).then(function() {
					this_._update_boxlist(store);
				});
			});
			$('#logout_dialog .logoutbtn').click(function() {
				store.logout();
			});			
		},
		_update_boxlist:function() {
			// get boxes
			var store = this.options.store, this_ = this, boxlist_el = this_.$el.find('.boxlist');
			store.fetch().then(function(boxlist) {
				var boxes = store.boxes();
				boxlist_el.children().remove();
				boxlist.map(function(box) {
					boxlist_el.append(_('<li><a data-id="<%= id %>" href="#"><%= name %></a></li>').template({id:box.id,name:box.toString()}));
				});
				this_.render();				
			});
		},
		set_selected_box_id:function(bid) {
			var store = this.options.store, this_ = this;
			var box = store.boxes().get(bid);
			u.assert(box, 'internal error - box is not defined ' + bid);
			this.trigger('select-box', bid);			
			this.$el.find('.selected-box').html(box === undefined ? ' no box selected ' : box.toString());
			this.selected_box = box;
		},
		_box_selected:function(d) {
			this.set_selected_box_id($(d.currentTarget).attr('data-id'));
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
			u.log('this el ', this.el);
			if (!this.$el.hasClass('toolbar')) {
				return this.load_templates().then(function(t1,t2) { this_._render_update();	});
			}
			this._render_update();
			return this;
		}
	});
})();
