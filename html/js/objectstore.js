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

    // Functions to communicate with the ObjectStore server
    ObjectStore.fetch_graph = function(graph, store, uri, callback){
        // return a list of models (each of type ObjectStore.Object) to populate a GraphCollection
        $.ajax({
            url: store.server_url,
            data: {"graph": uri},
            success: function(data){
                callback(new ObjectStore.GraphCollection(data));
            }
        });
    }

    // ObjectStore.Store represents the store, and returns ObjectStore.Graphs
    var Store = ObjectStore.Store = Backbone.Collection.extend({
        server_url: "http://localhost:8211/webbox/objectstore",
        model: ObjectStore.Graph,
        initialize: function(){
            console.debug("Init store.");

            this.bind("add", function(model){
                // A graph has been added to the store
            });
        },
        get: function(uri){
            // get a graph of uri
            return new Graph({"_store": this, "@id": uri});
        }
    });

    // ObjectStore.Graph is a named graph, which contains a ObjectStore.GraphCollection of ObjectStore.Objs
    var Graph = ObjectStore.Graph = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
        initialize: function(attributes){
        },
        fetch: function(){
            // replaces graph.objects with a GraphCollection and calls the callback
            var graph = this;
            ObjectStore.fetch_graph(this, this.get("_store"), this.get("@id"), function(objects){
                graph.set("objects", objects);
            });
        }
/*
        get: function(attribute){

        },
        set: function(attributes, options){

        }
*/
    });

    // ObjectStore.GraphCollection is the list of ObjectStore.Objs in a ObjectStore.Graph
    var GraphCollection = ObjectStore.GraphCollection = Backbone.Collection.extend({
        model: ObjectStore.Obj,
        initialize: function(models, options){

        },
        get: function(uri){
            // get an Obj by uri
            
        }
    });


    // ObjectStore.Obj are individual objects that are part of a ObjectStore.GraphCollection
    var Obj = ObjectStore.Obj = Backbone.Model.extend({
        idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
        initialize: function(attributes){

        },
        get: function(attribute){

        },
        set: function(attributes, options){

        }
    });

}).call(this);
