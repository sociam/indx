/*
    This file is part of WebBox.

    Copyright 2012 Daniel Alexander Smith
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

/* Author: Daniel A. Smith

*/

(function(){
    /* ObjectStore.js is a Backbone model for storing objects in WebBox. */
    var root = this;

    // The top-level namespace
    var ObjectStore;
    if (typeof exports !== 'undefined'){
        ObjectStore = exports;
    } else {
        ObjectStore = root.ObjectStore = {};
    }


    // ObjectStore.Store represents the store, and returns ObjectStore.Graphs
    var Store = ObjectStore.Store = Backbone.Collection.extend({
        server_url: "http://localhost:8211/webbox/objectstore",
        model: ObjectStore.Graph,
        objectstore_type: "store",
        initialize: function(){
            console.debug("Init store.");

            /*
            this.bind("add", function(model){
                // A graph has been added to the store
            });
            */
        },
        get: function(uri){
            // get a graph of uri
            return new Graph({"_store": this, "@id": uri});
        },
        sync: function(method, model, options){
            switch(method){
                case "create":
                    break;
                case "read":
                    var store = model;
                    return ObjectStore.list_graphs(store);
                case "update":
                    break;
                case "delete":
                    break;
                default:
                    break;
            }
        }
    });

    // ObjectStore.Graph is a named graph, which contains a ObjectStore.GraphCollection of ObjectStore.Objs
    var Graph = ObjectStore.Graph = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
        objectstore_type: "graph",
        initialize: function(attributes){
        },
        create: function(object_attrs){
            // add a new object to this graph (ObjectStore.GraphCollection will create an Obj from this)

            // pad string into an object with a URI
            if (typeof(object_attrs) == 'string'){
                object_attrs = {"@id": object_attrs};
            }

            var clone = _.clone(object_attrs);
            clone['_graph'] = this;

            var model = new ObjectStore.Obj(clone);
            this.get("objects").add(model);
            return model;
        },
        sync: function(method, model, options){
            switch(method){
                case "create":
                    break;
                case "read":
                    var graph = model;
                    return ObjectStore.fetch_graph(model, model.get("_store"), model.get("@id"));
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


    // ObjectStore.Obj are individual objects that are part of a ObjectStore.GraphCollection
    var Obj = ObjectStore.Obj = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
        objectstore_type: "obj",
        get: function(attr){
            if (attr in this.attributes){
                return this.attributes[attr];
            } else {
                return [];
            }
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
                    return model.attributes._graph.sync("update", model.attributes._graph, options);
                case "delete":
                    break;
                default:
                    break;
            }
            return d.promise();
        },
    });

    // ObjectStore.GraphCollection is the list of ObjectStore.Objs in a ObjectStore.Graph
    var GraphCollection = ObjectStore.GraphCollection = Backbone.Collection.extend({
        model: ObjectStore.Obj,
        objectstore_type: "graphcollection",
    });


    // Functions to communicate with the ObjectStore server
    ObjectStore.list_graphs = function(store, callback){
        // return a list of named graphs (each of type ObjectStore.Graph) to populate a GraphCollection
        return $.ajax({
            url: store.server_url,
            data: {},
            dataType: "json",
            type: "GET",
            success: function(data){

                var graph_uris = data;
                var graphs = [];
                $.each(graph_uris, function(){
                    var graph_uri = this;
                    var graph = new ObjectStore.Graph({"@id": graph_uri, "_store": store});
                    graphs.push(graph);
                });

                store.reset(graphs);
            }
        });
    };

    ObjectStore.update_graph = function(graph){
        var graph_objs = [ // object to PUT to the server
        ]

        $.each(graph.get("objects").models, function(){
            var obj = this;
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
                    if (typeof val === "string" || val instanceof String){
                        obj_vals.push({"@value": val});
                    } else if (val instanceof ObjectStore.Obj) {
                        obj_vals.push({"@id": val.id });
                    } else {
                        obj_vals.push(val); // val is a fully expanded string, e.g. {"@value": "foo", "@language": "en" ... }
                    }
                });

                out_obj[pred] = obj_vals;
            });
            graph_objs.push(out_obj);
        });

        var store = graph.attributes._store;
        var url = store.server_url+"?graph="+escape(graph.id)+"&version="+escape(graph._version);

        console.debug("Sending PUT.");

        return $.ajax({
            url: url,
            processData: false,
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(graph_objs),
            type: "PUT",
            success: function(data){
                // TODO check that it worked
                graph._version = data["@version"];
            }
        });
    };

    ObjectStore.fetch_graph = function(graph, store, uri){
        // return a list of models (each of type ObjectStore.Object) to populate a GraphCollection
        return $.ajax({
            url: store.server_url,
            data: {"graph": uri},
            dataType: "json",
            type: "GET",
            success: function(data){
                var graph_collection = new ObjectStore.GraphCollection();
                graph_collection._store = store;

                graph.set("objects", graph_collection); 

                var version = 0; // new version FIXME check
                $.each(data, function(uri, obj){
                    if (uri == "@version"){
                        version = obj;
                    }
                    if (uri[0] == "@"){
                        // ignore @graph etc.
                        return;
                    }

                    var obj_model = {"@id": uri, "_graph": graph};

                    $.each(obj, function(key, vals){
                        var obj_vals = [];
                        $.each(vals, function(){
                            var val = this;
                            if ("@id" in val){
                                var val_obj = graph.create({"@id": val["@id"]});
                                obj_vals.push(val_obj);
                            } else if ("@value" in val){
                                // if the string has no language or datatype, compress to just a string.
                                if ("@language" in val && val["@language"] == "" && "@type" in val && val["@type"] == ""){
                                    obj_vals.push(val["@value"]);
                                } else {
                                    obj_vals.push(val);
                                }
                            }
                        });
                        obj_model[key] = obj_vals;
                    });

                    graph.create(obj_model);
                });
                graph_collection._version = version;
                graph._version = version;
            }
        });
    };

}).call(this);
