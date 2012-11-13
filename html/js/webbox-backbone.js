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
  ObjectStore.js is the JS Client SDK for WebBox ObjectStore
  which builds upon Backbone's Model architecture.

  @prerequisites:
    jquery 1.8.0 or higher
	backbone.js 0.9.2 or higher
	underscore.js 1.4.2 or higher
*/

(function(){
	// intentional fall-through to window if running in a browser
    var root = this;
	
    // The top-level namespace
    var ObjectStore;
    if (typeof exports !== 'undefined'){
		ObjectStore = exports;
	} else {
         ObjectStore = root.ObjectStore = {};
    }

	// utilities -----------------
	var isInteger = function(n) { return n % 1 === 0; };
	var assert = function(t,s) { if (!t) { throw new Error(s); } };
	var deferred = function() { return new $.Deferred(); };
	var dict = function(pairs) { var o = {};	pairs.map(function(pair) { o[pair[0]] = pair[1]; }); return o; };
	var defined = function(x) { return (!_.isUndefined(x)) && x !== null; };
	var authajax = function(store, path, passed_options) {
		var url = store.options.server_url + path;
		var options = {
			type:'GET',
			url : url,
            contentType: "application/json",
            dataType: "json",			
			xhrFields: { withCredentials: true }
		};
		options = _(_(options || {}).clone()).extend(passed_options);
		return $.ajax( options ); // returns a deferred		
	};

	// MAP OF THIS MODUULE :::::::::::::: -----
	// 
	// An Obj is a single instance, thing in WebBox.
	//   
	// Graph contains an attribute called 'objects'
	// ... which is a collection of Obj objects
	// 
	// A Box is a model that has an attribute called 'graphs'.
	// ...  which is a Backbone.Collection of Graph objects.
	// 
	// A _Store_ represents a single WebBox server, which has an
	//     attribute called 'boxes' - 
	// ... which is a collection of Box objects

	// OBJ =================================================
    var Obj = ObjectStore.Obj = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
		initialize:function(attrs, options) {
			// pass graph
			assert(options.graph, "must provide a graph");
			this.graph = options.graph;
		},
        sync: function(method, model, options){
            var d = new $.Deferred();
            switch(method){
                case "create":
                    console.log("CREATE ", model.id);
                    break;
                case "read":
                    d.resolve();
                    break;
                case "update":
                    // delegate to the graph
                    console.debug("SAVE -- Update to Obj: ",model.id);
                    return model.graph.sync("update", model.graph, options);
                case "delete":
                    break;
                default:
                    break;
            }
            return d.promise();
        },
		_value_to_array:function(k,v) {
			if (k == '_id') { return v; }
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
			if (typeof(k) == 'string') {
				v = this._value_to_array(k,v);
			} else {
				k = this._all_values_to_arrays(k);
			}
			return Backbone.Model.prototype.set.apply(this,[k,v,options]);
		}
    });

	// GRAPH ==========================================================
    var ObjCollection = Backbone.Collection.extend({ model: Obj });
    var Graph = ObjectStore.Graph = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
        initialize: function(attributes, options) {
			assert(options.box, "no box provided");			
			this.box = options.box;
			if (!(attributes.objs instanceof ObjCollection)) {
				this.attributes.objs = new ObjCollection();
				if (attributes.objs) {
					this.attributes.objs.add(attributes.objs.models || attributes.objs);
				}
			}
		},
		objs:function() { return this.attributes.objs; },
		get_or_create:function(uri) {
			return this.objs().get(uri) || this.create(uri);
		},
        create: function(object_attrs){
            // add a new object to this graph (ObjectStore.GraphCollection will create an Obj from this)
            // pad string into an object with a URI
            if (typeof(object_attrs) == 'string'){
                object_attrs = {"@id": object_attrs};
            } 
            var model = new Obj(object_attrs, {graph : this});
            this.objs().add(model);
            return model;
        },
        sync: function(method, model, options){
            switch(method){
                case "create":
                    break;
                case "read":
                    var graph = model;
                    return ObjectStore.fetch_graph(graph);
                case "update":
                    console.debug("Update graph called on graph:",model);
                    return ObjectStore.update_graph(model);
                case "delete":
                    break;
                default:
                    break;
            }
        }
    });	

	// Box =================================================
    // ObjectStore.GraphCollection is the list of ObjectStore.Objs in a ObjectStore.Graph
    var GraphCollection = Backbone.Collection.extend({ model: Graph });
	var Box = ObjectStore.Box = Backbone.Model.extend({
		idAttribute:"@id",
		initialize:function(attributes, options) {
			assert(options.store, "no store provided");
			this.store = options.store;
			if (!(attributes.graphs instanceof GraphCollection)) {
				this.attributes.graphs = new GraphCollection();
				if (attributes.graphs) {
					this.attributes.graphs.add(attributes.graphs.models || attributes.graphs);
				}
			}
		},
		graphs:function() { return this.attributes.graphs; },
		get_or_create:function(uri) { return this.graphs().get(uri) || this.create(uri); },
        create: function(attrs){
            // add a new object to this graph (ObjectStore.GraphCollection will create an Obj from this)
            // pad string into an object with a URI
            if (typeof(attrs) == 'string'){ attrs = {"@id": attrs};   } 
            var model = new Graph(attrs, {box: this});
            this.graphs().add(model);
            return model;
        },		
        sync: function(method, model, options){
            switch(method){
            case "create":
				console.warn('box.create() : not implemented yet');				
				break;
            case "read":
				var box = model;
                return ObjectStore.list_graphs(box);
            case "update":
				console.warn('box.update() : not implemented yet');
				break;
            case "delete":
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
			var this_ = this;
			var store = this.options.store;
			var d = deferred();			
			authajax(store, 'admin/list_boxes')
				.success(function(data) {
					var boxes = data.boxes.map(function(boxname) {
						return new Box({"@id":boxname, name:boxname}, { store: store });
					})
					this_.reset(boxes);
					d.resolve(boxes);
				})
				.error(function(e) { d.reject(e); });
			return d.promise();
		}
	});
	
	var Store = ObjectStore.Store = Backbone.Model.extend({
		defaults: {
			server_url: "http://localhost:8211/"
		},
		initialize: function(attributes, options){
			this.options = _(_(this.defaults).clone()).extend(options);
			// get the boxes list from the server
			this.attributes.boxes = new BoxCollection((options && options.boxes) || [], {store: this});
			console.log('initialized store ', this.options.server_url);
        },
		fetch_boxes:function() { return this.boxes().fetch(); },
		boxes:function() { return this.attributes.boxes;  },
		get_or_create: function(buri) { return this.boxes().get(buri) || this.create(buri); },
		create:function(buri) {
			var box = new Box({"@id" : buri }, { store: this });
			this.boxes().add(box);
			console.log("created a box ", box.id );
			return box;
		},
		login : function() {
			return authajax(this, 'auth/login', { type: "POST" });
	    },
		logout : function() {
			return authajax(this, 'auth/logout', { type: "POST" });			
	    }
    });

    // Functions to communicate with the ObjectStore server
    ObjectStore.list_graphs = function(box, callback){
        // return a list of named graphs (each of type ObjectStore.Graph) to populate a GraphCollection
        return $.ajax({
            url: box.store.options.server_url + box.id,
            data: {},
            dataType: "json",
            type: "GET",
            xhrFields: { withCredentials: true },
            success: function(data){
                var graph_uris = data;
                var graphs = [];
                $.each(graph_uris, function(){
                    var graph_uri = this;
                    var graph = new Graph({"@id": graph_uri}, {box: box});
                    graphs.push(graph);
                });
                box.graphs().reset(graphs);
            }
        });
    };

	var serialize_obj = function(obj) {
        var uri = obj.id;
        var out_obj = {};
        $.each(obj.attributes, function(pred, vals){
            if (pred[0] == "_"){
                return;
            }
            if (pred[0] == "@"){ // don't expand @id etc.
                out_obj[pred] = vals;
                return;
            }
            var obj_vals = [];
            if (!(vals instanceof Array)){
                vals = [vals];
            }
            $.each(vals, function(){
                var val = this;
				if (val instanceof ObjectStore.Obj) {
                    obj_vals.push({"@id": val.id });
                } else if (typeof(val) == "object" && ("@value" in val || "@id" in val)) {
					// not a ObjectStore.Obj, but a plan JS Obj
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
		return out_obj;
	};

    ObjectStore.update_graph = function(graph){
		var d = deferred();
		var graph_objs = graph.objects().map(function(obj){ return serialize_obj(this);	});
        var store = graph.box.store;
		var call_url = graph.box.id + "/update?graph="+escape(graph.id)+"&version="+escape(graph.version);
        authajax(store, call_url, {type: "PUT", processData:false, data:JSON.stringify(graph_objs)}).then(function(data) {
			console.log('update_graph got data on return ', data, " new version ", data["@version"]);
			graph.version = data["@version"];
			d.resolve(graph);
		}).fail(function(err) {	d.reject(err);});
		return d.promise();				 
    };

    ObjectStore.fetch_graph = function(graph){
		var store = graph.box.store;
		var uri = graph.id;
		var d = deferred();
        // return a list of models (each of type ObjectStore.Object) to populate a GraphCollection
        authajax(store, graph.box.id, { data: {"graph": uri} })
			.then(function(data){
				console.log('fetch_graph got data :: ', data);
                var graph_collection = graph.objs();
                var version = 0; // new version FIXME check
				var objdata = JSON.parse(data.data);
                $.each(objdata, function(uri, obj){
					// top level keys
                    if (uri == "@version"){ version = obj; }
                    if (uri[0] == "@"){
						// ignore @id, @graph
                        return;
                    }
					// not one of those, so must be a
					// < uri > : { prop1 .. prop2 ... }
					var obj_model = graph.get_or_create(uri);
					console.log('getting ', obj_model.id);
                    $.each(obj, function(key, vals){
                        var obj_vals = [];
                        vals.map(function(val) { 
                            if ("@id" in val){
                                return graph.get_or_create(val["@id"]);
                            } else if ("@value" in val){
                                // if the string has no language or datatype, compress to just a string.
                                if ("@language" in val && val["@language"] === "" && "@type" in val && val["@type"] === "") {
                                    return val["@value"];
                                } else {
                                    return val;
                                }
                            }
							assert(false, "cannot unpack value ", val);
                        });
                        obj_model.set(key,obj_vals,{silent:true});
                    });
					obj_model.change();
                });
                graph.version = version;
				d.resolve(graph);
            }).fail(function(data) {
				d.reject(graph);
			});
		return d.promise();
	};
}).call(this);
