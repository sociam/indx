/*global $,_,document,window,console,escape,Backbone,exports,require,assert */
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
	
	// The top-level namespace
	if (typeof exports !== 'undefined'){ WebBox = exports;	}
	else { WebBox = root.WebBox = {}; }

	// utilities -----------------> should move out to utils
	var isInteger = function(n) { return n % 1 === 0; };
	var assert = function(t,s) { if (!t) { throw new Error(s); } };
	var deferred = function() { return new $.Deferred(); };
	var dict = function(pairs) { var o = {};	pairs.map(function(pair) { o[pair[0]] = pair[1]; }); return o; };
	var defined = function(x) { return (!_.isUndefined(x)) && x !== null; };

	// set up our parameters for webbox -
	// default is that we're loading from an _app_ hosted within
	// webbox. 
	var dlh = document.location.host;
	var DEFAULT_HOST = dlh.indexOf(':') < 0 ? dlh : dlh.slice(0,dlh.indexOf(':'));
	var DEFAULT_PORT = dlh.indexOf(':') < 0 ? 80 : parseInt(dlh.slice(dlh.indexOf(':')+1), 10);

	var authajax = function(store, path, passed_options) {
		var url = store.options.server_url + path;
		var options = {
			type:'GET',
			url : url,
			crossDomain: true,
			jsonp: false,
			contentType: "application/json",
			dataType: "json",
			xhrFields: { withCredentials: true }
		};
		options = _(_(options || {}).clone()).extend(passed_options);
		return $.ajax( options ); // returns a deferred		
	};
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
				} else if (_.isNumber(val) && isInteger(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#integer"});
				} else if (_.isNumber(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#float"});
				} else if (_.isBoolean(val)) {
					obj_vals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#boolean"});
				} else {
					console.warn("Could not determine type of val ", val);
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
			// pass graph
			assert(options.graph, "must provide a graph");
			this.graph = options.graph;
		},		
		sync: function(method, model, options){
			var d = new $.Deferred();
			// TODO: make this do something to support
			// individual access
			/*
			  switch (method) {
			  case "create":
			  console.log("CREATE ", model.id);
			  break;
			  case "read":
			  d.resolve();
			  break;
			  case "update":
			  // delegate to the graph
			  // console.debug("SAVE -- Update to Obj: ",model.id);
			  assert(false, "Individual OBJ sync not implemented yet.");
			  // return model.graph.sync("update", model.graph, options);
			  break;
			  case "delete":
			  break;
			  default:
			  break;
			  }
			*/			
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
			return dict(_(o).map(function(v,k) {
				var val = this_._value_to_array(k,v);
				if (defined(val)) { return [k,val]; }
			}).filter(defined));
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
			this.box = options.box;
			this.options = options;
			this.version = 0; // starts at 0
			if (!(attributes.objs instanceof ObjCollection)) {
				this.attributes.objs = new ObjCollection();
				if (attributes.objs) {
					this.attributes.objs.add(attributes.objs.models || attributes.objs);
				}
			}
		},
		objs:function() { return this.attributes.objs; },
		get_or_create:function(uri) { return this.objs().get(uri) || this.create(uri);	},
		create: function(object_attrs){
			// add a new object to this graph (WebBox.GraphCollection will create an Obj from this)
			// pad string into an object with a URI
			if (typeof object_attrs === 'string'){
				object_attrs = {"@id": object_attrs};
			} 
			var model = new Obj(object_attrs, {graph : this});
			this.objs().add(model);
			return model;
		},
		_update_graph : function(graph){
			var d = deferred(),
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
			var store = graph.box.store, uri = graph.id, d = deferred();
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
								assert(false, "cannot unpack value ", val);
							});
							obj_model.set(key,obj_vals,{silent:true});
						});
						obj_model.change();
					});
					console.log(">>> setting graph version ", graph.id, " ", version);
					graph.version = version;
					d.resolve(graph);
				}).fail(function(data) { d.reject(graph);});
			return d.promise();
		},
		sync: function(method, model, options){
			switch(method){
			case "create":
				break;
			case "read":
				return this._fetch(model);
			case "update":
				return this._update_graph(model);
			case "delete":
				break;
			default:
				break;
			}
		}
	});	

	// Box =================================================
	// WebBox.GraphCollection is the list of WebBox.Objs in a WebBox.Graph
	var GraphCollection = Backbone.Collection.extend({ model: Graph });
	var Box = WebBox.Box = Backbone.Model.extend({
		idAttribute:"@id",
		initialize:function(attributes, options) {
			assert(options.store, "no store provided");
			this.store = options.store;
			this.options = _(options).clone();
			if (!(attributes.graphs instanceof GraphCollection)) {
				this.attributes.graphs = new GraphCollection();
				if (attributes.graphs) {
					this.attributes.graphs.add(attributes.graphs.models || attributes.graphs);
				}
			}
		},
		_set_token:function(token) { this.set("token", token); },
		load:function() {
			// this method retrieves an auth token and proceeds to 
			// load up the graphs
			var this_ = this;
			var d = deferred();
			// get token for this box ---
			authajax(this.store, 'auth/get_token', {
				data: { appid: this.store.options.appid, boxid: this.id },
				type: "POST"
			}).then(function(data) {
				this_._set_token( data.token );
				this_.fetch().then(function() { d.resolve(this_); }).fail(function(err) {
					console.error(' error fetching ', this_.id, err);
					d.reject(err);					
				});
			});
			return d.promise();			
		},
		graphs:function() { return this.attributes.graphs; },
		get_or_create:function(uri) { return this.graphs().get(uri) || this.create(uri); },
		create: function(attrs){
			// add a new object to this graph (WebBox.GraphCollection will create an Obj from this)
			// pad string into an object with a URI
			if (typeof attrs === 'string'){ attrs = {"@id": attrs}; } 
			var model = new Graph(attrs, {box: this});
			this.graphs().add(model);
			return model;
		},
		_fetch : function(){
			var d = deferred();
			var this_ = this;
			assert(this.token, "No token associated with this this", this);
			authajax(this.options.store, this.id, { data: { token:this.token } })
				.then(function(data) {
					var graph_uris = data.data;
					var old_graphs = this_.graphs();
					var graphs = graph_uris.map(function(graph_uri){
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
			case "create":
				// TODO:
				console.warn('box.update() : not implemented yet');
				break;
			case "read":
				return model._fetch(); 
			case "update":
				// TODO: 
				console.warn('box.update() : not implemented yet');
				break;
			case "delete":
				// TODO: 
				console.warn('box.delete() : not implemented yet');
				break;
			default:
				break;
			}
		}
	});
	
	var BoxCollection = Backbone.Collection.extend({
		model: Box,
		initialize:function(models,options) {
			assert(options.store, "dont know where my store is ");
			this.options = options;
		},
		fetch:function() {
			// fetches list of boxes
			var this_ = this,
			store = this.options.store,
			d = deferred();			
			authajax(store, 'admin/list_boxes')
				.success(function(data) {
					var boxes = data.boxes.map(function(boxid) {
						return this_.get(boxid) || new Box({"@id":boxid, name:boxid}, {store: store});
					});
					this_.reset(boxes);
					d.resolve(boxes);
				})
				.error(function(e) { d.reject(e); });
			return d.promise();
		}
	});
	
	var Store = WebBox.Store = Backbone.Model.extend({
		defaults: {
			server_url: "http://"+DEFAULT_HOST+":"+DEFAULT_PORT+"/",
			appid:"--default-app-id--"
		},
		initialize: function(attributes, options){
			this.options = _(_(this.defaults).clone()).extend(options);
			console.log('setting server url ', this.options.server_url);						
			// get the boxes list from the server
			this.attributes.boxes = new BoxCollection((options && options.boxes) || [], {store: this});
		},
		fetch:function() { return this.boxes().fetch(); },
		boxes:function() { return this.attributes.boxes;  },
		checkLogin:function() { return authajax(this, 'auth/whoami'); },
		getInfo:function() { return authajax(this, 'admin/info');},
		login : function(username,password) {
			var d = deferred();
			var this_ = this;
			authajax(this, 'auth/login', { data: { username: username, password: password },  type: "POST" })
				.then(function(l) { this_.trigger('login', username); d.resolve(l); })
				.fail(function(l) { d.reject(l); });			
			return d.promise();
		},
		logout : function() {
			var d = deferred();
			var this_ = this;
			authajax(this, 'auth/logout', { type: "POST" })
				.then(function(l) { this_.trigger('logout'); d.resolve(l); })
				.fail(function(l) { d.reject(l); });
			return d.promise();			
		},		
		create_box:function(boxid) {
			// actually creates the box above
			var d = deferred();
			var this_ = this;
			authajax(this, 'admin/create_box', { data: { name: boxid },  type: "POST" })
				.then(function() {
					this_.boxes().fetch()
						.then(function(box) { d.resolve(box); })
						.fail(function(err) { d.reject(err); });
				}).fail(function(err) { d.reject(); });
			return d.promise();
		},
		list_boxes : function() {
			var this_ = this;
			return authajax(this, 'admin/list_boxes', { type: "GET" });
		}		
	});
	
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
