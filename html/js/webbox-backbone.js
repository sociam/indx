/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true */

/*
  This file is part of WebBox.
  Copyright 2012 Max Van Kleek, Daniel Alexander Smith
  Copyright 2012 University of Southampton

  WebBox is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  WebBox is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with WebBox.  If not, see <http://www.gnu.org/licenses/>.
*/
/*
  WebBox.js is the JS Client SDK for WebBox WebBox
  which builds upon Backbone's Model architecture.

  @prerequisites:
	jquery 1.8.0 or higher
	backbone.js 0.9.2 or higher
	underscore.js 1.4.2 or higher
*/



(function(){
	// intentional fall-through to window if running in a browser
	"use strict";
	var root = this, WebBox;
	var NAMEPREFIX = true;
	// The top-level namespace
	if (typeof exports !== 'undefined'){ WebBox = exports.WebBox = {};	}
	else { WebBox = root.WebBox = {}; }

	// utilities -----------------> should move out to utils
	var u; // to be filled in by dependency
	
	// set up our parameters for webbox -
	// default is that we're loading from an _app_ hosted within
	// webbox. 
	var DEFAULT_HOST = document.location.host;

	var serialize_obj = function(obj) {
		var uri = obj.id;
		var out_obj = {};
		$.each(obj.attributes, function(pred, vals){
			if (pred[0] === "_" || pred[0] === "@"){
				// don't expand @id etc.
				return;
			}
			var obj_vals = [];
			if (!(vals instanceof Array)){
				vals = [vals];
			}
			$.each(vals, function(){
				var val = this;
				if (val instanceof WebBox.Obj) {
					obj_vals.push({"@id": val.id });
				} else if (typeof val === "object" && (val["@value"] || val["@id"])) {
					// not a WebBox.Obj, but a plan JS Obj
					obj_vals.push(val); // fully expanded string, e.g. {"@value": "foo", "@language": "en" ... }
				} else if (typeof val === "string" || val instanceof String ){
					obj_vals.push({"@value": val});
				} else if (_.isDate(val)) {
					obj_vals.push({"@value": val.toISOString(), "@type":"http://www.w3.org/2001/XMLSchema#dateTime"});
				} else if (_.isNumber(val) && u.isInteger(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#integer"});
				} else if (_.isNumber(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#float"});
				} else if (_.isBoolean(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#boolean"});
				} else {
					u.warn("Could not determine type of val ", val);
					obj_vals.push({"@value": val.toString()});
				}
			});
			out_obj[pred] = obj_vals;
		});
		out_obj['@id'] = uri;
		return out_obj;
	};
	

	// MAP OF THIS MODUULE :::::::::::::: -----
	// 
	// An Obj is a single instance, thing in WebBox.
	// Graph contains an attribute called 'objects'
	// ... which is a collection of Obj objects
	// 
	// A Box is a model that has an attribute called 'graphs'.
	// ...  which is a Backbone.Collection of Graph objects.
	// 
	// A _Store_ represents a single WebBox server, which has an
	//	 attribute called 'boxes' - 
	// ... which is a collection of Box objects

	// OBJ =================================================
	var Obj = WebBox.Obj = Backbone.Model.extend({
		idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
		initialize:function(attrs, options) {
			this.graph = options.graph;
		},		
		sync: function(method, model, options){
			u.error('object sync methods individually not implemented yet'); // TODO
			var d = new $.Deferred();
			d.resolve();
			return d.promise();
		},
		_value_to_array:function(k,v) {
			if (k === '@id') { return v; }
			if (!_(v).isUndefined() && !_(v).isArray()) {
				return [v];
			}
			return v;			
		},		
		_all_values_to_arrays:function(o) {
			if (!_(o).isObject()) {	console.error(' not an object', o); return o; }
			var this_ = this;
			// ?!?! this isn't doing anything (!!)
			return u.dict(_(o).map(function(v,k) {
				var val = this_._value_to_array(k,v);
				if (u.defined(val)) { return [k,val]; }
			}).filter(u.defined));
		},
		set:function(k,v,options) {
			// set is tricky because it can be called like
			// set('foo',123) or set({foo:123})
			if (typeof k === 'string') {
				v = this._value_to_array(k,v);
			} else {
				k = this._all_values_to_arrays(k);
			}
			return Backbone.Model.prototype.set.apply(this,[k,v,options]);
		}
	});

	// GRAPH ==========================================================
	var ObjCollection = Backbone.Collection.extend({ model: Obj });
	var Graph = WebBox.Graph = Backbone.Model.extend({
		idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
		initialize: function(attributes, options) {
			assert(options.box, "no box provided");
			this.set({version: 0, objs:new ObjCollection()});
			this.box = options.box;
		},
		objs:function() { return this.get('objs'); },
		get_or_create:function(uri) {
			return this.objs().get(uri) || this.create(uri);
		},
		create: function(id){
			var model = new Obj({"@id":id}, {graph:this});
			this.objs().add(model);
			return model;
		},
		_update_graph : function(graph){
			var d = u.deferred(),
			graph_objs = graph.objs().map(function(obj){ return serialize_obj(obj);	}),
			box = graph.box;			
			graph.box.ajax("/update",
					"PUT", { graph : escape(graph.id),  version: escape(graph.version), data : JSON.stringify(graph_objs) }).then(function(response) {
						graph.version = response.data["@version"];
						d.resolve(graph);
					}).fail(function(err) {	d.reject(err);});
			return d.promise();
		},
		_fetch : function(graph){
			var store = graph.box.store, uri = graph.id, d = u.deferred();
			// return a list of models (each of type WebBox.Object) to populate a GraphCollection
			graph.box.ajax("/", "GET", {"graph": uri})
				.then(function(data){
					var graph_collection = graph.objs();
					var version = 0;
					var objdata = data.data;					
					$.each(objdata, function(uri, obj){
						// top level keys
						if (uri === "@version") { version = obj; }
						if (uri[0] === "@") { return; } // ignore "@id" etc					
						// not one of those, so must be a
						// < uri > : { prop1 .. prop2 ... }
						var obj_model = graph.get_or_create(uri);
						$.each(obj, function(key, vals){
							var obj_vals = vals.map(function(val) {
								// it's an object, so return that
								if (val.hasOwnProperty("@id")) { return graph.get_or_create(val["@id"]); }
								// it's a non-object
								if (val.hasOwnProperty("@value")) {
									// if the string has no language or datatype, turn it just into a string
									if (val["@language"] === "" && val["@type"] === "") { return val["@value"];}
									// otherwise return the value as-is
									return val;
								}
								u.assert(false, "cannot unpack value ", val);
							});
							obj_model.set(key,obj_vals,{silent:true});
						});
						obj_model.change();
					});
					u.log(">>> setting graph version ", graph.id, " ", version);
					graph.version = version;
					d.resolve(graph);
				}).fail(function(data) { d.reject(graph);});
			return d.promise();
		},
		sync: function(method, model, options){
			switch(method){
			case "create": return u.warn('graph.create not implemented yet'); // TODO
			case "read": return this._fetch(model);
			case "update":return this._update_graph(model);
			case "delete": return u.warn('graph.delete not implemented yet'); // TODO
			}
		}
	});	

	// Box =================================================
	// WebBox.GraphCollection is the list of WebBox.Objs in a WebBox.Graph
	var GraphCollection = Backbone.Collection.extend({ model: Graph });
	var Box = WebBox.Box = Backbone.Model.extend({
		idAttribute:"@id",
		initialize:function(attributes, options) {
			u.assert(options.store, "no store provided");
			this.store = options.store;
			this.set({graphs: new GraphCollection()});
		},
		_set_token:function(token) { this.set("token", token);	},
		load:function() {
			// this method retrieves an auth token and proceeds to 
			// load up the graphs
			var this_ = this;
			var d = u.deferred();
			// get token for this box ---
			this.ajax('POST', 'auth/get_token', { app: this.store.get('app') })
				.then(function(data) {
					this_._set_token( data.token );
					this_.fetch().then(function() {	d.resolve(this_);}).fail(function(err) {
						console.error(' error fetching ', this_.id, err);
						d.reject(err);					
					});
				});
			return d.promise();			
		},
		toString:function() {
			if (this.get('name')) { return (NAMEPREFIX ? 'box:' : '') + this.get('name'); }
			return (NAMEPREFIX ? 'box:' : '') + this.id;
		},
		ajax:function(method, path, data) {
			var data = _(_(data||{}).clone()).extend({box: this.id, token:this.get('token')});
			console.log('this ajax ', this.store, method, path, this.get('token'), data);			
			return this.store.ajax(method, path, data);
		},
		graphs:function() { return this.attributes.graphs; },
		get_or_create:function(uri) { return this.graphs().get(uri) || this.create(uri); },
		create: function(id){
			// add a new object to this graph (WebBox.GraphCollection will create an Obj from this)
			// pad string into an object with a URI
			var model = new Graph({'@id':id}, {box:this});
			this.graphs().add(model);
			return model;
		},
		_fetch : function(){
			var d = u.deferred();
			var this_ = this;
			console.log('fetch!! ', this.id);
			this.ajax('GET', this.id).then(function(data) {
				console.log('fetch data ', data);
				var graph_uris = data.data;
				var old_graphs = this_.graphs();
				var graphs = graph_uris.map(function(graph_uri){
					u.log(graph_uri);
					var graph = old_graphs.get(graph_uri) || new Graph({"@id": graph_uri}, {box: this_});
					return graph;
				});
				old_graphs.reset(graphs);
				d.resolve(graphs);
			}).fail(function(err) { d.reject(err); });
			return d.promise();
		},
		sync: function(method, model, options){
			switch(method){
			case "create": return u.warn('box.update() : not implemented yet');
			case "read": return model._fetch(); 
			case "update": return u.warn('box.update() : not implemented yet');
			case "delete": return u.warn('box.delete() : not implemented yet');
			}
		}
	});
	
	var BoxCollection = Backbone.Collection.extend({ model: Box });
	var Store = WebBox.Store = Backbone.Model.extend({
		defaults: {
			server_url: "http://"+DEFAULT_HOST,
			app:"--default-app-id--",
			toolbar:true
		},
		ajax_defaults : {
			jsonp: false, contentType: "application/json",
			xhrFields: { withCredentials: true }
		},
		initialize: function(attributes, options){
			console.log(" server ", this.get('server_url'));
			this.set({boxes : new BoxCollection(undefined, {store: this})});
			// load and launch the toolbar
			if (this.get('toolbar')) {
				this._load_toolbar();
			}
		},
		ajax:function(method, path, data) {
			var url = [this.get('server_url'), path].join('/');
			u.log(' store ajax ', method, url);
			var default_data = { app: this.get('app') };
			var options = _(_(this.ajax_defaults).clone()).extend(
				{ url: url, method : method, crossDomain: !this.is_same_domain(), data: _(default_data).extend(data) }
			);
			return $.ajax( options ); // returns a deferred		
		},
		is_same_domain:function() {
			return this.get('server_url').indexOf(document.location.host) >= 0 &&
				(document.location.port === (this.get('server_port') || ''));
		},
		_load_toolbar:function() {
			var el = $('<div></div>').addClass('unloaded_toolbar').appendTo('body');
			this.toolbar = new WebBox.Toolbar({el: el, store: this});
			this.toolbar.render();
		},
		boxes:function() { return this.attributes.boxes;  },
		checkLogin:function() { return this.ajax('GET', 'auth/whoami'); },
		getInfo:function() { return this.ajax('GET', 'admin/info');},
		login : function(username,password) {
			var d = u.deferred();
			var this_ = this;
			this.ajax('POST', 'auth/login', { username: username, password: password })
				.then(function(l) { this_.trigger('login', username); d.resolve(l); })
				.fail(function(l) { d.reject(l); });			
			return d.promise();
		},
		logout : function() {
			var d = u.deferred();
			var this_ = this;
			this.ajax('POST', 'auth/logout')
				.then(function(l) { this_.trigger('logout'); d.resolve(l); })
				.fail(function(l) { d.reject(l); });
			return d.promise();			
		},		
		create_box:function(boxid) {
			// actually creates the box above
			var d = u.deferred();
			var this_ = this;
			this.ajax('POST', 'admin/create_box', { name: boxid })
				.then(function() {
					this_.boxes().fetch()
						.then(function(box) { d.resolve(box); })
						.fail(function(err) { d.reject(err); });
				}).fail(function(err) { d.reject(); });
			return d.promise();
		},
		_fetch:function() {
			// fetches list of boxes
			var this_ = this, d = u.deferred();			
			this.ajax('GET','admin/list_boxes')
				.success(function(data) {
					var boxes =	data.list
						.map(function(boxid) {
							return this_.get(boxid) || new Box({'@id': boxid}, {store: this_});
						});
					this_.boxes().reset(boxes);
					d.resolve(boxes);
				})
				.error(function(e) { d.reject(e); });
			return d.promise();
		},
		sync: function(method, model, options){
			switch(method){
			case "create": return u.warn('store.update() : not implemented yet'); // TODO
			case "read"  : return model._fetch(); 
			case "update": return u.warn('store.update() : not implemented yet'); // TODO
			case "delete": return u.warn('store.delete() : not implemented yet'); // tODO
			}
		}			
	});

	var dependencies = [
		'/js/vendor/bootstrap.min.js',
		'/js/vendor/lesscss.min.js',
		'/js/utils.js',
		'/components/toolbar/toolbar.js'
	];
	
	WebBox.load = function(base_url) {
		if (base_url === undefined) {
			base_url = ['http:/', document.location.host].join('/');
		}
		console.log('loading from base url ', base_url);		
		var _load_d = new $.Deferred(); 
		var ds = dependencies.map(function(s) {
			console.log('getting script ', base_url + s);
			return $.getScript(base_url + s);
		});
		$.when.apply($,ds).then(function() {
			u = WebBox.utils;
			console.log('LOADING TOOLBAR');
			WebBox.Toolbar.load_templates(base_url).then(function() {
				_load_d.resolve(root);
			}).fail(function(err) { console.error(err); _load_d.reject(root);   });
		}).fail(function(err) { console.error(err); _load_d.reject(root); });
		return _load_d.promise();
	};
}).call(this);


/**
   moved from box >> 
   ajax : function( path, type, data ) {
   var url = this.store.options.server_url + this.id + path;
   var this_ = this;
   var options = {
   type: type,
   url : url,
   crossDomain: true,
   jsonp: false,
   contentType: "application/json",
   dataType: "json",
   data: _({ token:this_.get('token') }).extend(data),
   xhrFields: { withCredentials: true }
   };
   return $.ajax( options ); // returns a deferred		
   },		
*/
