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
		var IndxModel = Backbone.Model.extend({			
			initialize:function(attrs, options) { 
				this.box = options.box;
			},
			save:function() { 
				return this.box.save(this);
			},
			fetch:function() { 
				console.log('fetch unnecessary --  ');
				return;
			}
		});
		var IndxCollection = Backbone.Collection.extend({			
			model:IndxModel
		});

		var Box = Backbone.Model.extend({
			initialize:function(attribs) {
				var bid = attribs.id;
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
				if (attribs.make_indexes !== undefined) {
					db.migrations.push({
						version:2,
						migrate:function(transaction, next) { 
							try {
								var store = transaction.objectStore(bid);
								attribs.make_indexes.map(function(field) { 
									store.createIndex(field + "index", field, { unique: false });
						        });
						        next();
						    } catch(e) { console.error(e); }
						}
					});
				}
				// internal models only!
				this.model = Backbone.Model.extend({ database: db, storeName:bid });
				// cache for external models
				this._objcache = new IndxCollection();
			},
			_createModelForID: function(id) {
				var m = new IndxModel({id:id},{box: this});
				this._objcache.add(m);
				return m;
			},
			save:function(models) {
				console.log('save >> ', models);
				var this_ = this, newmodels = [], saving = {};
				var serialise = function(val, saving, newmodels) {
					if (!_.isObject(val)) {	return val;	}
					if (_.isArray(val)) {
						return val.map(function(v) { return serialise(v,saving,newmodels); });
					}
					if (_.isObject(val) && val.id !== undefined) {
						var sobj = { "@id": val.id };
						if (saving[val.id] === undefined && newmodels.indexOf(val) <= 0) { 
							console.log('newmodels push');
							newmodels.push(val);							
						}
						return sobj;
					}
					u.assert(false, "didnt know how to serialise");
					return undefined;
				}, dosave = function(models, dfds, newmodels) {
					console.log('dosave models >> ', models);
					return u.when(models.map(function(model) {
						var lm = new this_.model({id:model.id}); 
						dfds[model.id] = u.deferred();
						_(model.attributes).map(function(v,k) {	lm.set(k,serialise(v, dfds, newmodels));	});
						lm.save().then(dfds[model.id].resolve).fail(dfds[model.id].reject);
						return dfds[model.id];
					}));
				}, recurse = function(saving, newmodels) { 
					var modchunk = newmodels.splice(0, newmodels.length);
					var d = u.deferred();
					dosave(modchunk, saving, newmodels).then(function() { 
						if (newmodels.length > 0) {
							recurse(saving, newmodels).then(d.resolve).fail(d.reject);
							return;
						}
						d.resolve(); // resolve righ taway to go on to the next level
					}).fail(d.reject);
					return d.promise();
				};

				// prime the saving/newmodels pump
				(_(models).isArray() ? models : [models]).map(function(m) { 
					serialise(m, saving, newmodels); 
				});				
				console.log("after priming >> ", saving, newmodels);
				recurse(saving, newmodels);
				return u.when(saving);				
			},
			getObj:function(objid) {
				// getObj always returns a promise
				// console.debug(' getObj() >> ', objid);

				u.assert(typeof objid === 'string' || typeof objid === 'number' || _.isArray(objid), "objid has to be a number or string or an array of such things");

				var ids = _.isArray(objid) ? objid : [objid], this_ = this,
					fetching = {}, newids = [], skeletons = {}, objcache = this._objcache;

				var deserialise_obj = function(id, skelmodels, deferredset, newids_) {
					// case 1 : deserialising now
					if (skelmodels[id] !== undefined) { return skelmodels[id];	}					
					// case 2: already deserialised
					var cachedobj;
					if ((cachedobj = objcache.get(id)) !== undefined) { 
						deferredset[id] = u.deferred(); // u.dresolve(cachedobj); // create a new placeholder 
						skelmodels[id] = cachedobj;
						return cachedobj; 	
					}
					// case 3 : not deserialised yet
					skelmodels[id] = this_._createModelForID(id);
					deferredset[id] = u.deferred(); // create a new placeholder 
					newids_.push(id);
					return skelmodels[id];
				};
				var deserialise = function(s_obj, into_model, deferredset, silent, skels, newids_) {
					// resolves all of the properties into things that we have or
					// know about
					var _des = function(val) {
						// object
						if (!_.isObject(val)) {	return val;	}							
						if (_.isObject(val) && val.hasOwnProperty('@id')) { 
							return deserialise_obj(val['@id'], skels, deferredset, newids_);
						}							
						console.error('couldnt deserialise ', val);
						return undefined;
					};
					_(s_obj).map(function(vals, key) {
						into_model.set(key,_.isArray(vals) ? vals.map(_des) : _des(vals),{silent: silent});
					});					
				};
				var fetch = function(ids, skels, deferredset, newids_) {
					var d = u.deferred();
					var fetches = ids.map(function(id) { 
						var inner_m = new this_.model({id:id}),
							di = u.deferred();
						inner_m.fetch().then(function() {	
							console.log('fetched inner_m!! ', inner_m.id, inner_m.attributes);
							deserialise(inner_m.attributes, skels[id], deferredset, true, skels, newids_);
							deferredset[id].resolve(skels[id]);
							di.resolve(skels[id]);							
						}).fail(function(e) { 
							console.error('didnt exist, new object');
							// deserialise(inner_m.attributes, skels[id], deferredset, true, skels, newids_);							
							deferredset[id].resolve(skels[id]);
							di.resolve(skels[id]);							
						});
						// 

						return di.promise();
					});
					u.when(fetches).then(d.resolve).fail(d.reject);
					return d.promise();
				};

				// prime the newids / deferreds with all of the next guys we have to fetch
				ids.map(function(id) { 	
					deserialise_obj(id, skeletons, fetching, newids); 
				});
				var ds = _(fetching).values();

				var recurse = function(ids) { 
					var idchunk = newids.splice(0,newids.length);
					var d = u.deferred();
					fetch(idchunk, skeletons, fetching, newids).then(function() { 
						if (newids.length > 0) {
							recurse(newids).then(d.resolve).fail(d.reject);
							return;
						}
						d.resolve(); // resolve righ taway to go on to the next level
					}).fail(d.reject);
					return d.promise();
				};

				var d0 = u.deferred();
				recurse(newids).then(function() { 
					if (_.isArray(objid)) { 
						u.when(objid.map(function(x) { return fetching[x]; })).then(d0.resolve).fail(d0.reject); 
					} else {
						fetching[objid].then(d0.resolve).fail(d0.reject);
					}
				}).fail(d0.reject);
				return d0.promise();
			},

		});

		var Store = Backbone.Model.extend({
			initialize:function() { 
				this.boxes =  new Backbone.Collection({model:Box});
			},
			getBox:function(bid, make_indexes) { 
				if (!this.boxes.get(bid)) { 
					this.boxes.add(new Box({id:bid,make_indexes:make_indexes}));
				}
				return u.dresolve(this.boxes.get(bid));
			}
		});


		var s, 
			getStore = function() { 
				if (!s) { s = new Store(); }
				return s; 
			},
			tests = {
				test3 : function(id) {
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
				},
				test : function(boxid) { 
					var s = getStore(), ds = {}, d = u.deferred();
					s.getBox(boxid || 'a').then(function(box) {
						window.box = box;
						var ds = [];
						u.range(10).map(function(x) {
							var uid = u.guid(10);
							ds[uid] = u.deferred();
							box.getObj(uid).then(function(obj) { 
								console.log('getObj completed >> ', obj.attributes);
								obj.set({name:'hello', thing:u.guid()});
								obj.save().then(ds[uid].resolve).fail(ds[uid].reject);
							});
						});
						u.when(_(ds).values()).then(function(x) { 
							console.log('all done!'); 
							d.resolve(_(ds).keys()); 
						}).fail(function(e) { 
							console.error(e); 
							d.reject(); 
						});
					}).fail(function(err) { 
						console.error('couldnt get box '); 
					});
					return d.promise();
				},
				test2 : function(boxid) { 
					var s = getStore(), ds = {}, d = u.deferred();
					s.getBox(boxid || 'a').then(function(box) {
						var ds = [], uids = u.range(10).map(function(x) {
							var uid = u.guid(10);
							ds[uid] = u.deferred();
							return uid;
						});
						box.getObj(uids).then(function(objs) { 
							console.log('getObjs completed >> ', objs);
							objs.map(function(obj) { 
								obj.set({name:'hello', first:objs[0],all:objs,thing:u.guid()});
							});
							objs.map(function(obj) { 
								obj.save().then(ds[obj.id].resolve).fail(ds[obj.id].reject);
							});
						});
						u.when(_(ds).values()).then(function(x) { 
							console.log('all done!'); 
							d.resolve(_(ds).keys()); 
						}).fail(function(e) { 
							console.error(e); 
							d.reject(); 
						});
					}).fail(function(err) { 
						console.error('couldnt get box '); 
					});
					return d.promise();
				}
			};

		setTimeout(function() { 
			tests.test2().then(function(ids) { 
				getStore().getBox('a').then(function(b) {
					console.log('test continuation >>');
					window.b = b;
					console.log('getting object >> ', ids[0]);
					b.getObj(ids[0]).then(function(o) { 
						window.oo = o;
						console.log('object >> ', o);
					});
				}).fail(function() { console.error('sad'); });
			});
		}, 100);

		return {
			getStore : getStore,
			tests : tests,
			deleteDB:deleteDB
		};
	});
	