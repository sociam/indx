/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */

///  @title indx-offline.js
///  @author Max Van Kleek
///  @since 2014
///  @see http://github.com/sociam/indx
///  @see http://indx.es
///
///  Javascript ORM client for INDX that makes it easy to
///  read and write objects from one or more INDX data store(s).

///  #### Copying
///  Copyright (C) 2011-2014 Max Van Kleek
///
///  This program is free software: you can redistribute it and/or modify
///  it under the terms of the GNU Affero General Public License, version 3,
///  as published by the Free Software Foundation.
///
///  This program is distributed in the hope that it will be useful,
///  but WITHOUT ANY WARRANTY; without even the implied warranty of
///  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
///  GNU Affero General Public License for more details.
///
///  You should have received a copy of the GNU Affero General Public License
///  along with this program.  If not, see <http://www.gnu.org/licenses/>.
///

angular
	.module('indx')
	.factory('local',function(utils) {

		// (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)		
		var u = utils, log = utils.log, error = utils.error, debug = utils.debug, jQ = jQuery;

		var IndxModel = Backbone.Model.extend({
			/// @arg {String} p - Property to fetch
			/// @return {value || undefined} - Returns this.get('property')[0] if the property exists
			/// returns the id of this object			
			getFirst:function(p) { return this.get(p,[])[0]; },
			peek: function(p) { return this.get(p,[])[0]; },
			// @arg {String} p - Property to push on to
			// @arg {value} v - Value to push onto end of p
			// Pushes v onto array of p if exists otherwise creates new array
			push:function(p,v) { 
				var ov = this.get(p);
				if (ov !== undefined) {
					ov.push(v);
					return this.trigger('change:'+p,ov);
				}
				this.set(p,[v]);
			},
			// @arg {String} p - Property to push on to
			// @arg {value} v - Value to push onto end of p
			// Pops last element off of property p
			pop:function(p) { 
				var result = this.get(p,[]).pop();
				this.trigger('change:'+p,this.get(p));
				return result;
			},
			_allValuesToArrays:function(o) {
				if (!_(o).isObject()) { utils.error(' not an object', o); return o; }
				var this_ = this;
				// ?!?! this isn't doing anything (!!)
				return u.dict(_(o).map(function(v,k) {
					var val = this_._valueToArray(k,v);
					if (u.defined(val)) { return [k,val]; }
					return undefined;
				}).filter(u.defined));
			},
			set:function(k,v,options) {
				// set is tricky because it can be called like
				// set('foo',123) or set({foo:123})
				if (typeof k === 'string') { v = this._valueToArray(k,v);	}
				else {	k = this._allValuesToArrays(k);	}
				return Backbone.Model.prototype.set.apply(this,[k,v,options]);
			},
			fetch:function() { 
				console.log('fetch!!!'0;
				return Backbone.model.fetch.apply(this, arguments);
			},
			save:function() {
				console.log('save!!!'0;
				return Backbone.model.save.apply(this, arguments);
			}
		});
		
		function deleteDB(dbid) {
		    try {
		        var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
		        var dbreq = indexedDB.deleteDatabase(dbid);
		        dbreq.onsuccess = function (event) {
		            var db = event.result;
		        };
		        dbreq.onerror = function (event) {
		            console.error("indexedDB.delete Error: " + event.message);
		        };
		    }
		    catch (e) {
		        console.error("Error: " + e.message);
		        //prefer change id of database to start ont new instance
		        console.log("fallback to new database name :" + dbid);
		    }
		}

		var Store = Backbone.Model.extend({
			initialize:function() { 
				this.collections_by_boxid = {};
				this.deferreds_by_boxid = {};
			},
			_makeBox:function(bid, make_indexes) { 
				u.assert(bid !== undefined, "box id has to be defined");
				var db = {
			 		id:bid,
			 		description:'indx local store',
				 	migrations: [
				 		{
				 			version:1,
				 			migrate:function(transaction, next){
				 				var store = transaction.db.createObjectStore(bid);
				 				next();
				 			}
				 		}
				 	]			 			
				};
				if (make_indexes !== undefined) {
					db.migrations.push({
						version:2,
						migrate:function(transaction, next) { 
							try {
								var store = transaction.objectStore(bid);
								make_indexes.map(function(field) { 
									store.createIndex(field + "index", field, { unique: false });
						        });
						        next();
						    } catch(e) { console.error(e); }
						}
					});
				}
			 	var DBModel = IndxModel.extend({ database: db, storeName:bid	}),
				 	Collection = Backbone.Collection.extend({ 
				 		database:db,
				 		storeName:bid,
				 		model: DBModel,
				 		getObj:function(id) {
				 			if (this.get(id) !== undefined) { 
				 				return u.dresolve(this.get(id));
				 			}
				 			console.log('doesnt exist, making new ');
				 			return u.dresolve(new this.model({id:id}));
				 		}
				 	});
				this.collections_by_boxid[bid] = Collection;

			 	var collection = new Collection(), d = u.deferred();
			 	collection.fetch().then(function() {
			 		d.resolve(collection); 
			 	}).fail(d.reject);
			 	return d.promise();
			},
			getBox:function(bid, make_indexes) { 
				if (this.deferreds_by_boxid[bid]) {
					return this.deferreds_by_boxid[bid];
				} 
				this.deferreds_by_boxid[bid] = this._makeBox(bid, make_indexes);
				return this.deferreds_by_boxid[bid];
			}
		});


		var s, 
		getStore = function() { 
				if (!s) { s = new Store(); }
				return s; 
		},
		test3 = function(id) {
			var s = getStore();
			var boxid = id || u.guid(6);
			s.getBox(boxid,['name']).then(function(box) {
				var a = window.as = [];
				var ds = u.range(100).map(function(i) { 
					var guid = u.guid(6), d_ = u.deferred();
					box.getObj(guid).then(function(x) {
						a.push(x);
						console.log('got obj >> ', x.id);
						x.set({name:['hello','hi', 'goodbye'][i%3], date:i});
						x.save().then(d_.resolve);
					});
					return d_.promise();
				});
				u.when(ds).then(function() { 
					var query = new s.collections_by_boxid[boxid]();
					query.fetch({
						conditions: {name:'hello'},
						success: function () {
							console.log('wins ', query.models.length, query.models);
							console.log(query.models.map(function(x) { return x.id; }));
                            // equal(query.models.length, 2, "Should have 2 elements");
                            // deepEqual(theater.pluck("title"), ["Bonjour", "Ciao"], "Should have [\"Bonjour\", \"Ciao\"]");
                        },
						error: function (object, error) {
                            console.error('couldnt query -- ', object, error);
                        }                            
					}).then(function() { 
						console.log('hello and hi hits ', query.length);
					}).fail(function(r) { 
						console.error(r); 
					});
				}).fail(function(x) { console.error('sad '); });
			}).fail(function(err) {	console.error('couldnt get box '); 	});
		};
		setTimeout(function() { test3(); }, 100);

		return {
			getStore : getStore,
			test : function(boxid) { 
				var s = this.getStore();
				s.getBox(boxid || 'a').then(function(box) {
					window.box = box;
					var ds = [];
					u.range(10).map(function(x) {
						var uid = u.guid(10);
						// var result = box.create({id:uid, test:u.guid(5), message:'hello'});
						var obj = new box.model({id:uid, test:u.guid(5), message:'hello'});
						ds.push(obj.save());
					});
					u.when(ds)
						.then(function(x) { console.log('all done!'); })
						.fail(function(e) { console.error(e); });
				}).fail(function(err) { 
					console.error('couldnt get box '); 
				});
			},
			test2 : function(boxid) { 
				var s = this.getStore();
				s.getBox(boxid || 'a').then(function(box) {
					var guid = u.guid();
					box.getObj(guid).then(function(x) {
						console.log('created x >> ');
						u.assert(x.id == guid, 'ids didnt match');
						x.set({baby:true});
						x.save();
					});
				}).fail(function(err) {
					console.error('couldnt get box '); 
				});
			},
			test3 : test3,
			deleteDB:deleteDB
		};

	});
	