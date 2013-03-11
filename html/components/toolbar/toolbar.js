/*global $,_,document,window,console,escape,Backbone */
/*jslint vars:true, todo:true, sloppy:true */

var root = this, WebBox;
// The top-level namespace
if (typeof exports !== 'undefined'){ WebBox = exports.WebBox;}
else { WebBox = root.WebBox; }

(function() {
	console.log("TOOLBAR >>>>> ");	
	var u = WebBox.utils, templates;
	var ToolbarView = WebBox.Toolbar = Backbone.View.extend({
		tagClass:"div",
		events: { 'click .boxlist a' : '_box_selected'	},
		initialize:function(options) {
			u.assert(this.options.store, "must pass in store");
		},
		first_render:function() {
			var t_templ = templates.main.template, l_templ = templates.login.template, store = this.options.store, this_ = this;
			this.$el.html(t_templ).addClass('toolbar navbar-fixed-top navbar');
			// set up listeners from store
			store.on('login', function(username) {
				u.debug('toolbar :: login ');
				this_.username = username; this_.render();
				this_.trigger('login', username);
			}).on('logout', function(username) {
				u.debug('toolbar :: logout ');				
				this_.set_selected_box_id(); // clear selected box
				delete this_.username; this_.render();
				this_.trigger('logout');				
			}).on('change:boxes', function() {
				u.debug('toolbar :: change boxes ');								
				this_._update_boxlist();
			}).on('change:selected-box', function(bid) {
				u.debug('toolbar :: selected box ');												
				this_.set_selected_box_id(bid);
			});
			// check to see if already logged in 
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
			$('body').append(this.$el).append(l_templ);			
			$('#login_dialog .loginbtn').click(function() {
				var u = $('#login_dialog .username_field').val(), p = $('#login_dialog .password_field').val();
				store.login(u,p).then(function() { this_._update_boxlist(store); });
			});
			$('#logout_dialog .logoutbtn').click(function() { store.logout(); });			
		},
		_update_boxlist:function() {
			// get boxes
			var store = this.options.store, this_ = this, boxlist_el = this_.$el.find('.boxlist');
			store.fetch().then(function(boxlist) {
				var boxes = store.boxes();
				boxlist_el.children().remove();
				boxlist.map(function(box) {
					boxlist_el.append(_('<li><a data-id="<%= id %>" href="#"><%= name %></a></li>').template({
						id:box.get_id(),name:box.get_id()
					}));
				});
				this_.render();				
			});
		},
		set_selected_box_id:function(bid) {
			var store = this.options.store, this_ = this, box;
			if (bid !== undefined) { 
				box = store.boxes().get(bid);
				u.assert(box, 'internal error - box is not defined ' + bid);
			}
			this.$el.find('.selected-box').html(box === undefined ? ' no box selected ' : box.get_id());
			this.trigger('change:selected-box', bid);
			this.selected_box = box;
		},
		_box_selected:function(d) {
			this.set_selected_box_id($(d.currentTarget).attr('data-id'));
		},
		_render_update:function() {
			if (this.username) {
				this.$el.find('.username_display a').html(this.username);
				this.$el.find('.username_display').show();
				this.$el.find('.login_display').hide();				
			} else {
				this.$el.find('.username_display').hide();
				this.$el.find('.login_display').show();				
			}		
		},														
		render:function() {
			var this_ = this;
			if (!this.$el.hasClass('toolbar')) {
				this.first_render();
				return this_._render_update();
			}
			this._render_update();
			return this;
		}
	});
	ToolbarView.load_templates = function(server_url) {
		templates = {
			main: { url: [server_url, 'components/toolbar/t_template.html'].join('/') },
			login:{ url: [server_url, 'components/toolbar/login_template.html'].join('/')}
		};		
		var ds = $.when.apply($, _(templates).keys().map(function(tname) {
			var d = new $.Deferred();
			$.get(templates[tname].url).then(function(t) {
				templates[tname].template = t;
				d.resolve(t);
			});
			return d.promise();
		}));
		return $.when.apply($,ds);
	};
	WebBox.loader_dependencies.toolbar.dfd.resolve(WebBox.Toolbar);	
}());
