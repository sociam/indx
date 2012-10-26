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
                    ObjectStore.list_graphs(store, function(objects){
                        store.reset(objects);
                    });
                    break;
                case "update":
                    /*
                    console.debug("Update graph called on graph:",model);
                    ObjectStore.update_graph(model);
                    */
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
        /*
        fetch: function(){
            // replaces graph.objects with a GraphCollection and calls the callback
            var graph = this;
            ObjectStore.fetch_graph(this, this.get("_store"), this.get("@id"), function(objects){
                graph.set("objects", objects);
            });
        }
        */
        sync: function(method, model, options){
            switch(method){
                case "create":
                    break;
                case "read":
                    var graph = model;
                    ObjectStore.fetch_graph(model, model.get("_store"), model.get("@id"), function(objects){
                        graph.set("objects", objects);
                    });
                    break;
                case "update":
                    console.debug("Update graph called on graph:",model);
                    ObjectStore.update_graph(model);
                    break;
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
            switch(method){
                case "create":
                    break;
                case "read":
                    break;
                case "update":
                    // delegate to the graph
                    console.debug("Update to Obj: ",model);
                    model.attributes._graph.sync("update", model.attributes._graph, options);
                    break;
                case "delete":
                    break;
                default:
                    break;
            }
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
        $.ajax({
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

                callback(graphs);
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
                out_obj[pred] = vals;
            });
            graph_objs.push(out_obj);
        });

        var store = graph.attributes._store;
        var url = store.server_url+"?graph="+escape(graph.id)+"&version="+escape(graph._version);

        console.debug("Sending PUT.");

        $.ajax({
            url: url,
            processData: false,
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(graph_objs),
            type: "PUT",
            success: function(data){
                // TODO check that it worked
                // TODO record new version number
                graph._version = data["@version"];
            }
        });
    };

    ObjectStore.fetch_graph = function(graph, store, uri, callback){
        // return a list of models (each of type ObjectStore.Object) to populate a GraphCollection
        $.ajax({
            url: store.server_url,
            data: {"graph": uri},
            dataType: "json",
            type: "GET",
            success: function(data){

                var objs = [];
                var version = -1;
                $.each(data, function(uri, obj){
                    if (uri == "@version"){
                        version = obj;
                    }
                    if (uri[0] == "@"){
                        // ignore @graph etc.
                        return;
                    }
                    if (!("@id" in obj)){
                        obj["@id"] = uri;
                    }
                    obj._graph = graph;
                    objs.push(obj);
                });

                var graph_collection = new ObjectStore.GraphCollection(objs);
                graph_collection._store = store;
                graph_collection._version = version;
                graph._version = version;

                callback(graph_collection);
            }
        });
    };

}).call(this);
