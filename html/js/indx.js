/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */
///  @title indx.js
///  @author Daniel Alexander Smith
///  @author Max Van Kleek
///  @author Peter West
///  @since 2013
///  @see http://github.com/sociam/indx
///  @see http://indx.es
///
///  Javascript ORM client for INDX that makes it easy to
///  read and write objects from one or more INDX data store(s).

///  #### Copying
///  Copyright (C) 2011-2013 University of Southampton
///  Copyright (C) 2011-2013 Daniel Alexander Smith
///  Copyright (C) 2011-2013 Max Van Kleek
///  Copyright (C) 2011-2013 Nigel R. Shadbolt
///  Copyright (C) 2011-2013 Peter West
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
///
///  #### Features
///  * Real time read updates via websockets
///  * Cross-origin resource sharing (CORS) - e.g. client app can live on different
///  server than indx host
///  * Backbone based dat amodels
///
///
///   #### todos
///   * update only supports updating the entire box
///   * Box.fetch() retrieves _entire box contents_
///   ... which is a really bad idea.
///
///  #### Prerequisites:
///  * angular 1.0.8 or higher
///  * jquery 1.8.0 or higher
///  * backbone.js 0.9.2 or higher
///  * underscore.js 1.4.2 or higher


angular
	.module('indx', [])
	.factory('client',function(utils, indxws) {
		// long token support not fully implemented, disable for now

		var HTTP_OVER_WEBSOCKET = true; // change here to turn off 
		var ENABLE_LONG_TOKENS = false;
		var u = utils, log = utils.log, error = utils.error, debug = utils.debug, jQ = jQuery;
		var DEFAULT_HOST = document.location.host; // which may contain the port

		// new patch for nodejs support
		var ajax = jQ.ajax;		
		if (typeof process != 'undefined' && process.title === 'node' && typeof _NODE_AJAX !== 'undefined') {
			ajax = _NODE_AJAX(u,jQ);
		} 


		var _makeLocalUser = function(name) {
			return {"@id":name,user_type:'local',username:name,name:name};
		};

		var serialiseObj = function(obj) {
			var uri = obj.id;
			var outObj = {};
			jQ.each(obj.attributes, function(pred, vals){
				if (pred[0] === "_" || pred[0] === "@"){
					// don't expand @id etc.
					return;
				}
				var objVals = [];
				if (!(vals instanceof Array)){
					vals = [vals];
				}
				jQ.each(vals, function(){
					var val = this;
					if (val instanceof File) {
						objVals.push({"@value": val.id, "@type":"indx-file", "@language":val.get('content-type')});
					} else if (val instanceof Obj) {
						objVals.push({"@id": val.id });
					} else if (typeof val === "object" && (val["@value"] || val["@id"])) {
						objVals.push(val); // fully expanded string, e.g. {"@value": "foo", "@language": "en" ... }
					} else if (typeof val === "string" || val instanceof String ){
						objVals.push({"@value": val});
					} else if (_.isDate(val)) {
						objVals.push({"@value": val.toISOString(), "@type":"http://www.w3.org/2001/XMLSchema#dateTime"});
					} else if (_.isNumber(val) && u.isInteger(val)) {
						objVals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#integer"});
					} else if (_.isNumber(val)) {
						objVals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#float"});
					} else if (_.isBoolean(val)) {
						objVals.push({"@value": val.toString(), "@type":"http://www.w3.org/2001/XMLSchema#boolean"});
					} else {
						u.warn("Could not determine type of val ", pred, val);
						objVals.push({"@value": val.toString()});
					}
				});
				outObj[pred] = objVals;
			});
			outObj['@id'] = uri;
			return outObj;
		};

		var literalDeserialisers = {
			'': function(o) { return o['@value']; },
			"http://www.w3.org/2001/XMLSchema#integer": function(o) { return parseInt(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#float": function(o) { return parseFloat(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#double": function(o) { return parseFloat(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#boolean": function(o) { return o['@value'].toLowerCase() === 'true'; },
			"http://www.w3.org/2001/XMLSchema#dateTime": function(o) { return new Date(Date.parse(o['@value'])); },
			"indx-file": function(o,box) {
				var f = box.getOrCreateFile(o['@value']);
				f.set("content-type", o['@language']);
				return f;
			}
		};
		var deserialiseLiteral = function(obj, box) {
			return obj['@value'] !== undefined ? literalDeserialisers[ obj['@type'] || '' ](obj, box) : obj;
		};

		var deserialiseValue = function(sVal, box) {
			var vd = u.deferred();
			// it's an object, so return that
			if (sVal.hasOwnProperty("@id")) {
				// object
				box.getObj(sVal["@id"]).then(vd.resolve).fail(vd.reject);
			}
			else if (sVal.hasOwnProperty("@value")) {
				// literal
				vd.resolve(deserialiseLiteral(sVal, box));
			}
			else {
				// don't know what it is!
				vd.reject('cannot unpack value ', sVal);
			}
			return vd.promise();
		};

		var File =  Backbone.Model.extend({
			idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
			/// @construct
			initialize:function(attrs, options) {
				u.debug('options >> ', attrs, options );
				this.box = options.box;
			},
			getID:function() { return this.id;	},
			getURL:function() {
				var params = {
					id:this.getID(),
					app:this.box.store.get('app'),
					token:this.box.get('token'),
					box:this.box.getID()
				}, url = [this. 	box.store._getBaseURL(), this.box.id, 'files'].join('/') + '?' + jQ.param(params);
				// u.debug("IMAGE URL IS ", url, params);
				return url;
			}
		});

		var ObjProxy = function(get_deferred) {
			var this_ = this;
			this.d = get_deferred.pipe(function(x) { 
				this_.obj = x;
				return u.dresolve();
			});
		};
		ObjProxy.prototype = {
			get:function(field, continuation) {
				var this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						return jQuery.when(continuation(obj.map(function(obj_i) { return obj_i.get(field); })));
					} else {
						return jQuery.when(continuation(obj.get(field)));
					}
				});
				return this;
			},
			set:function(obj) {
				var a = _.toArray(arguments), this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						obj.map(function(obj_i) { return obj_i.set.apply(obj_i, a); });
					} else {
						obj.set.apply(obj, a);
					}
					return u.dresolve();
				});
				return this;
			},
			save:function() {
				var a = _.toArray(arguments), this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						return u.when(obj.map(function(obj_i) { return obj_i.save(); }));
					} else {
						// console.log('saving >>>>>>>>>>>> ');
						// var d = u.deferred();
						// setTimeout(function() { 
						// 	console.log('done >>>>>>>>');
						// 	d.resolve(); 
						// }, 2000);
						// return d.promise();
						// real code >> 
						return obj.save();
					}
				});
				return this;
			},
			destroy:function(obj) {
				var a = _.toArray(arguments), this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						return u.when(obj.map(function(obj_i) { return obj_i.destroy(); }));
					} else {
						return obj.destroy();
					}
				});
				return this;	
			},
			on:function() {
				var a = _.toArray(arguments), this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						obj.map(function(obj_i) { return obj_i.on.apply(obj_i, a); });
					} else {
						obj.on.apply(obj, a);
					}
					return u.deferred();
				});
				return this;		
			},
			off:function() {
				var a = _.toArray(arguments), this_ = this;
				this.d = this.d.pipe(function() { 
					var obj = this_.obj;
					if (_.isArray(obj)) {
						obj.map(function(obj_i) { return obj_i.off.apply(obj_i, a); });
					} else {
						obj.off.apply(obj, a);
					}
					return u.deferred();
				});
				return this;		
			},			
			then:function(f) {
				var this_ = this;
				this.d = this.d.pipe(function() { 
					// console.log("EXECUTING THEN");
					var obj = this_.obj;
					return jQuery.when(f(obj));
				});
				return this;
			},
			fail:function(f) { 
				var this_ = this;
				this.d.fail(function(err) { 
					f(err,this_.obj);
				});
				return this;
			}
		};

		// MAP OF THIS MODUULE :::::::::::::: -----
		//
		// An Obj is a single instance, thing in Indx.
		//
		// A Box is a model that has an attribute called 'Objs'.
		// ...  which is a Backbone.Collection of Graph objects.
		//
		// A _Store_ represents a single Indx server, which has an
		//	 attribute called 'boxes' -
		// ... which is a collection of Box objects
		var Obj =  Backbone.Model.extend({
			idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
			/// @construct
			initialize:function(attrs, options) {
				this.box = options.box;
			},
			_isFetched: function() { return this._fetched || false; },
			_setFetched : function() { this._fetched = true; },
			/// @return {String} - ID of this object
			/// returns the id of this object
			getID:function() { return this.id;	},
			_checkObj:function(k,o) {
				if (!_.isObject(o) || _.isDate(o)) { return o; }
				if (o.id !== undefined) { return o; }
				// it's an object 
				if (o["@id"] !== undefined) {
					var oc = this.box.objcache().get(o["@id"]);
					if (oc !== undefined) {
						return oc;
					}										
				}
				var id = o["@id"] || [this.id,'-',k,u.guid(8)].join('');
				var m = this.box._createModelForID(id);
				m.set(o); // recurses! 
				m.save(); // todo this is not really okay.
				return m;
			},
			_valueToArray:function(k,v) {
				var this_ = this;
				if (_(v).isUndefined()) { return v; }
				if (k === '@id') { return v; }
				if (!_(v).isArray()) {
					return [this._checkObj(k,v)];
				} else {
					return v.map(function(vi) { return this_._checkObj(k,vi); });
				}
				return v;
			},
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
			extend:function(p,arr) {
				u.assert(_.isArray(arr), "array needs to be an array");
				return this.set(p, this.get(p, []).concat(arr));
			},
			length:function(p) {
				return this.get(p,[]).length;
			},
			indexOf:function(p,v) {
				return this.get(p, []).indexOf(v);
			},
			// gets or returns default v
			get:function(p,defaultv) { 
				return Backbone.Model.prototype.get.apply(this,[p]) || defaultv;		
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
			deleteProperties:function(props, silent)  {
				var this_ = this;
				props.map(function(p) { this_.unset(p, silent ? {silent:true} : {}); });
			},
			_deserialiseAndSet:function(s_obj, silent) {
				// returns a promise
				var this_ = this;
				var dfds = _(s_obj).map(function(vals, key) {
					if (key.indexOf('@') === 0) { return; }


					var kd = u.deferred();
					// skip "@id" etc etc
					var fetch_dfds = {};

					var val_dfds = vals.map(function(val) {
						var vd = u.deferred();
						// it's an object, so return that
						if (val.hasOwnProperty('@id')) {
							// object
							var oid = val['@id'];
							fetch_dfds[oid] = fetch_dfds[oid] ? fetch_dfds[oid].concat(vd) : [vd];
							// this_.box.getObj(val["@id"]).then(vd.resolve).fail(vd.reject);
						}
						else if (val.hasOwnProperty("@value")) {
							// literal
							vd.resolve(deserialiseLiteral(val, this_.box));
						}
						else {
							// don't know what it is!
							vd.reject('cannot unpack value ', val);
						}
						return vd.promise();
					});

					if (_(fetch_dfds).keys().length) { 
						// console.debug('batch fetch!', _(fetch_dfds).keys());
						this_.box.getObj(_(fetch_dfds).keys()).then(function(objs) {
							objs.map(function(o) { 
								fetch_dfds[o.id].map(function(dfd) { dfd.resolve(o); });
							});
						}).fail(function() { 
							_(fetch_dfds).values().map(function(dfds) { 
								console.error(' dfd >> ', dfds);
								dfds.map(function(dd) { dd.reject('error fetching obj'); });
							});
						});
					}

					u.when(val_dfds).then(function(objVals) {
						// only update keys that have changed
						var prevVals = this_.get(key);
						if ( prevVals === undefined || objVals.length !== prevVals.length || !u.quickSame(objVals,prevVals)) {
							this_.set(key, objVals, { silent : silent });
						}
						kd.resolve();
					}).fail(kd.reject);
					return kd.promise();
				}).filter(u.defined);
				return u.when(dfds);
			},
			_deserialiseAndSetForward:function(s_obj, silent, deferredset) {
				// returns a promise that will ring true when 
				// deferredset is resolved.
				var this_ = this;
				if (deferredset === undefined) { deferredset = {}; }
				var get_obj_d = function(id) { 
					if (deferredset[id] === undefined) { 
						console.log('adding an unfetched dude -------------', id);
						deferredset[id] = u.deferred(); 
					}
					return deferredset[id];
				};
				var get_d = function(val) { 
					// object
					if (val.hasOwnProperty('@id')) { return get_obj_d(val['@id']);}
					// literal
					else if (val.hasOwnProperty("@value")) { return u.dresolve(deserialiseLiteral(val, this_.box));		}
					// unknown
					return u.dreject('cannot unpack value ' + val.toString(), val);				
				};
				// keys for object
				var kds = _(s_obj).map(function(vals, key) {
					if (key.indexOf('@') === 0) { return; } // skip "@id" etc etc
					var kd = u.deferred();
					// values for keys
					var val_dfds = vals.map(function(val) {	return get_d(val); 	});
					u.when(val_dfds).then(function(resolved_vals) { 
						this_.set(key,resolved_vals,{silent: silent});
						kd.resolve();
					}).fail(kd.reject);
					return kd.promise();
				}).filter(u.defined);
				return u.when(kds); 
			},
			_loadFromJSON: function(json) {
				var objdata = json, this_ = this;
				if (objdata['@version'] === undefined) {
					// then the server thinks we've been deleted, so let's just die.
					return u.dreject(this.id);
				}
				// we are at current known version as far as we know
				var safe_dfds = _(objdata).map(function(obj,uri) {
					// top level keys - corresponding to box level properties
					if (uri[0] === "@") { return; } // ignore "@id", "@version" etc
					// not one of those, so must be a
					// < uri > : { prop1 .. prop2 ... }
					u.assert(uri === this_.id, 'can only deserialise this object ');
					return this_._deserialiseAndSet(obj);
				});
				return u.when(safe_dfds);
			},
			// this code path taken if someone just fetches one model directly using m.fetch()
			_fetch:function() {
				var this_ = this, fd = u.deferred(), box = this.box.getID();
				this.box._ajax('GET', box, {'id':this.id}).then(function(response) {
					this_._setFetched(true);
					this_._loadFromJSON(response.data)
						.then(function(){ fd.resolve(this_); }).fail(fd.reject);
				});
				return fd.promise();
			},
			sync: function(method, model, options){
				switch(method){
				case "create": return u.assert(false, "create is never used for Objs");
				case "read"  : return model._fetch();
				case "update":
					return model.box._simpleUpdate(model); // // model.box._update([model.id])[0];
				case "delete":
					return this.box._deleteModels([this.id])[0];
				}
			}
		});


		// Box =================================================
		// GraphCollection is the list of Objs in a Graph
		var ObjCollection = Backbone.Collection.extend({ model: Obj }),
			FileCollection = Backbone.Collection.extend({ model: File });

		// box proxy
		var BoxProxy = function(get_deferred) {
			var this_ = this;
			this.d = get_deferred.pipe(function(x) { 
				this_.box = x;
				return u.dresolve();
			});
		};
		BoxProxy.prototype = {
			obj:function(objid) {
				var this_ = this, dbox = u.deferred();
				this.d = this.d.pipe(function() { 
					this_.box.getObj(objid).then(dbox.resolve).fail(dbox.reject);
				});
				return new ObjProxy(dbox.promise());
			},
			then:function(dfd) {
				var this_ = this;
				this.d = this.d.pipe(function() { return jQuery.when(dfd(this_.box));});
				return this;
			},
			fail:function(f) { 
				var this_ = this;
				this.d.fail(function(err) { f(err,this_.box); });
				return this;
			}			
		};

		// new client: fetch is always lazy, only gets ids, and
		// lazily get objects as you go
		var Box = Backbone.Model.extend({
			idAttribute:"@id",
			defaultOptions: { useWebSockets:true, wsAutoReconnect:false	},
			/// @construct
			initialize:function(attributes, options) {
				var this_ = this;
				u.assert(options.store, "no store provided");
                this.set({objcache: new ObjCollection(), objlist: {}, dobjlist: {}, files : new FileCollection() });
				this.options = _({}).extend(this.defaultOptions, options);
				this.store = options.store;
				this.on('update-from-master', function() {
					// u.log("UPDATE FROM MASTER >> flushing ");
					this_._flushUpdateQueue();
					this_._flushDeleteQueue();
				});
				this.store.on('login', function() { console.debug('on login >> '); this_.reconnect(); });
				this._reset();
				// set up web socket connection whenever we get a new token
				// we want to manually update our websocket
				// this.on('new-token', function(token) { 
				// 	if (!this_.isConnected()) { return; }
				// 	this_.wsh._ws_auth()
				// 		.then(function() { console.log('new token auth success '); })
				// 		.fail(function() { 
				// 			console.error('error trying to ws_auth on new token ', token);
				// 		});
				// });
			},
			_flush_tokens:function() { 
				this._setToken();
			},
			_reset:function() {
				// this._updateQueue = {};
				// this._deleteQueue = {};
				// this._fetchingQueue = {};
				var rejectAll = function (dL) {	if (dL) { _(dL).values().map(function(d) { d.reject('reset'); });}	};
				rejectAll(this._updateQueue);
				this._updateQueue = {};
				rejectAll(this._deleteQueue);
				this._deleteQueue = {};
				rejectAll(this._fetchingQueue);
				this._fetchingQueue = {};
			},
			/// @arg {string} fid - file id
			/// Tries to get a file with given id. If it doesn't exist, a file with that name is created.
			/// @return {File} the file
			getOrCreateFile:function(fid) {
				var files = this.get('files');
				if (files.get(fid) === undefined) {
					files.add(new File({"@id": fid}, { box: this }));
				}
				return files.get(fid);
			},
			uncacheObj: function(obj) {
				return this._objcache().remove(obj);
			},
			isConnected:function() {
				return this.wsh && this.wsh.isConnected();
			},
			_disconnected:function() {
				// called after disconnected
				delete this.wsh;
				this._reset(); // kill all pending queues
			},
			disconnect:function() {
				if (this.wsh !== undefined) { 
					this.wsh.close();
					this._disconnected();
					return u.dresolve();
				}
				return u.dreject();
			},
			reconnect:function() {
				var this_ = this;
				if (this.isConnected()) { return u.dresolve();  }
				return this.getToken().pipe(function() { return this_._fetch(); });
			},
			/// Gets whether the option to use websockets has been set; set this option using the store's options.use_websockets;
			/// @return {boolean} - Whether will try to use websockets.
			getUseWebSockets:function() { return this.options.useWebSockets; },
			/// Returns C, the number of objects that have been loaded from the server. Necessararily C < getObjIDs.length()
			/// @return {integer} - Number of objects in the cache
			getCacheSize:function() { return this._objcache().length; },
			/// Gets all of the ids contained in the box
			/// @return {string[]} - Set of IDs
			getObjIDs:function() { 
				var ol = this.attributes.objlist;
				if (ol !== undefined) { return ol; }
				// this is going to be painful
				this.attributes.objlist = utils.fastkeys(this.attributes.dobjlist);
				return this.attributes.objlist;
			},
			_setObjListfromDict:function(dol) { 
				delete this.attributes.objlist; // next refresh
				this.attributes.dobjlist = dol;
			},
			_setObjDictfromList:function(dol) { 
				this.attributes.objlist = dol;
				this.attributes.dobjlist = utils.toBlankDict(dol);
			},
			_objlist : function() { return this.attributes.objlist; },
			_objlistdict : function() { return this.attributes.dobjlist; },			
			_objcache:function() { return this.attributes.objcache; },
			_getCachedToken:function() { return this.get("token"); },
			_getStoredTokenKeyname: function() { 
				return '__indx_box_token_' + this.getID();
			},
			_hasStoredToken:function() { 
				return typeof localStorage !== 'undefined' &&
					localStorage[this._getStoredTokenKeyname()] !== undefined && 
					localStorage[this._getStoredTokenKeyname()] !== 'undefined';
			},
			_getStoredToken:function() { 
				var token = typeof localStorage !== 'undefined' && localStorage[this._getStoredTokenKeyname()];
				if (token && token !== 'undefined') { return token; } 
				// otherwise undefined
			},
			_setStoredToken:function(token) {
				if (typeof localStorage !== 'undefined') { 
					localStorage[this._getStoredTokenKeyname()] = token;
				} 
				return undefined;
			},
			_clearStoredToken:function() { 
				delete localStorage[this._getStoredTokenKeyname()];
			},
			_setToken:function(token) { 
				this.set("token", token);	
				this._setStoredToken(token);
			},
			_setVersion:function(v) { this.set("version", v); },

			/// @return {integer} - Current version of the box
			/// gets the current version of this box
			getVersion:function() { return this.get("version"); },

			/// @then({Box}) - gets a token for this box and continues
			/// @fail({Error}) - returns the raised error
			/// Gets an auth token for the box. This is done automatically
			/// by a store when constructed by getBox.
			getToken:function() {
				// console.debug('>> getToken ', ' id: ',this.id, ' cid: ',this.cid);
				// try { throw new Error(''); } catch(e) { console.error(e); }
				if (this._get_token_queue === undefined) { this._get_token_queue = []; }
				var tq = this._get_token_queue, this_ = this, d = u.deferred(), box_id = this.getID();
				tq.push(d);
				window._b = this;
				if (tq.length === 1) { 
					// console.log('calling getToken -- ', box_id, ' app id ', this.store.get('app'));
					this.store._ajax('POST', 'auth/get_token', { box:box_id,  app: this.store.get('app') })
						.then(function(data) {
							console.debug('setting token ', data.token);
							this_._setToken( data.token );
							this_.trigger('new-token', data.token);
							this_._get_token_queue.map(function(d) { d.resolve(this_); });
							this_._get_token_queue = [];
						}).fail(function(bail) { 
							console.error('error getting auth/get_token ', bail);
							var args = arguments;
							if (this_.wsh) { 
								console.error('warning >> forcing disconnect ');
								this_.disconnect();							
							}
							this_._get_token_queue.map(function(d) { d.reject.apply(d,arguments); });
							this_._get_token_queue = [];
						});
				}	
				return d.promise();
			},
			/// Gets this box's id
			/// @return {integer} - this box's id
			getID:function() { return this.id || this.cid;	},
			_ajax:function(method, path, data) {
				// we may have no token any more! 
				var token = this._getCachedToken() || this._getStoredToken(), 
					box_id = this.getID(),
					this_ = this;
				// console.log('_ajax() call :: ', method, path, data, ' token: ', token);
				var cont = function() { 
					token = this_._getCachedToken() || this_._getStoredToken();
					if (HTTP_OVER_WEBSOCKET && this_.wsh) {
						// use websocket approach instead
						return this_.wsh.addHttpRequest(method, path, _(data||{}).extend({box:box_id, token:token, app:this_.store.get('app')}) );
					} 
					data = _(_(data||{}).clone()).extend({box:box_id, token:token});
					return this_.store._ajax(method, path, data);
				};
				if (token === undefined) { 
					var d = u.deferred();
					// console.error('ajax but no token :( trying.getToken() >> ');
					this.getToken().then(function() { 
						// console.info('ajax -- got token now continuing', this_._getCachedToken(), this_._getStoredToken());
						cont().then(d.resolve).fail(d.reject);
					}).fail(function(bail) { 
						// console.error('ajax -- getToken failed, bailing')
						d.reject(bail);
					});
					return d.promise();
				}
				return cont();
			},
			/// @arg {string} id - Identity to use for hte file
			/// @arg {HTML5File} filedata - HTML5 File object to put
			/// @arg {string} contenttype - Content type to store with the file (for use in serving back)
			/// uploads the file identified by file into the box, watching out for obsolete messages.
			/// Handles obsolete cases by merely waiting for a websocket update
			/// @then({INDX.File}) - returns created File object
			/// @fail(error) - returns Error object
			putFile:function(id,filedata,contenttype) {
				// creates a File object and hands it back in the resolve
				contenttype = contenttype || filedata.type;
				var d = u.deferred(), this_ = this, newFile = this.getOrCreateFile(id);
				newFile.set({"content-type": contenttype});
				this._doPutFile(id,filedata,contenttype).then(function(){
					u.debug('image put success ');
					d.resolve(newFile);
				}).fail(function(err) {
					if (err.status === 409) {
						/// @ignore
						var cb = function() {
							this_.off('update-from-master', cb, newFile);
							this_._putFile(id, filedata, contenttype).then(d.resolve).fail(d.reject);
						};
						this_.on('update-from-master', cb, newFile);
					} else {
						u.error('error putting, dammit ', err);
						d.reject(err);
					}
				});
				return d.promise();
			},
			// now uses relative url scheme '//blah:port/path';
			// all files must be PUT into boxname/files
			// here the parameters are get encoded
			// 'http://' + this.store.get('server_host') + "/" +  boxid + "/" + 'files',
			_doPutFile:function(id,file,contenttype) {
				var boxid = this.id || this.cid,
				baseURL = [this.store._getBaseURL(), boxid, 'files'].join('/'),
				options = { app: this.store.get('app'), id: id, token:this.get('token'),  box: boxid, version: this.getVersion() },
				optionParams = jQ.param(options),
				url = baseURL+"?"+optionParams,
				d = u.deferred();
				debug("PUTTING FILE ", url);
				var ajaxArgs  = _(_(this.store.ajaxDefaults).clone()).extend(
					{ url: url, method : 'PUT', crossDomain:false, data:file, contentType: contenttype, processData:false }
				);
				return ajax( ajaxArgs );
			},
			/// @arg {Object} queryPattern - a query pattern to match
			/// @opt {string[]} predicates - optional array of predicates to return, or entire objects otherwise; if '*' is passed, then raw JSON is returned and not returned as objects
			///
			/// Issues query to server, which then returns either entire objects or just values of the props specified
			///
			/// @then({Objs[]} Objects matching query) - When the query is successful
			/// @fail({string} Error) - When the query fails
			query: function(queryPattern, predicates){
				var d = u.deferred();
				var cache = this._objcache();
				var parameters = {"q": JSON.stringify(queryPattern)};
				var this_ = this;
				if (predicates && predicates !== '*') {
					if (!_.isArray(predicates)) { predicates = [predicates]; }
					_(parameters).extend({predicate_list: predicates});
				}
				var query_url = [this.getID(), 'query'].join('/');
				this._ajax("GET", query_url, parameters)
					.then(function(response) {
						var results = response.data;
						if (predicates) {
							// raw partials just including predicates - these are not whole
							// objects
							return d.resolve(results);
						}
						var fetch_dfds = {};
						// otherwise we are getting full objects, so ...
						var ds = _(results.data).map(function(dobj,id) {
							if (cache.get(id)) { return u.dresolve(cache.get(id)); }
							var model = this_._createModelForID(id), dv_ = u.deferred();
							model._deserialiseAndSetForward(dobj, true, fetch_dfds).then(function() { dv_.resolve(model); }).fail(dv_.reject);
							return dv_.promise();
						});
						// now we can fetch all of the things we've queued up
						// console.log('now fetching at once ', _(fetch_dfds).keys());
						if (_(fetch_dfds).keys().length) {
							this_.getObj(_(fetch_dfds).keys()).then(function(objs) { 
								objs.map(function(obj) { fetch_dfds[obj.id].resolve(obj); });
							}).fail(function(bail) { 
								_(fetch_dfds).values().map(function(dd) { dd.reject(bail); });
							});
						}
						u.when(ds).then(d.resolve).fail(d.reject);
					}).fail(function(err) { error(err); d.reject(err); });
				return d.promise();
			},
			standingQuery:function(queryPattern, callback) {
				var this_ = this, d = u.deferred(), wsh = this.wsh;
				this.query(queryPattern).then(function(results) { 
					results.map(function(result) { callback(result); });
					wsh.subscribeDiffQuery(queryPattern, function(diffdata) { 
						if (diffdata && diffdata.data) { 
							var acd = diffdata.data,
								ids = u.uniqstr([acd.added, acd.changed]
									.map(function(x) { return _(x).keys(); })
									.reduce(function(x,y) { return x.concat(y); }));
							console.info(acd, ' ~ asking for ids ', ids);
							this_.getObj(ids).then(function(objs) { 
								console.log('firing callback with objs >> ', objs);
								objs.map(function(obj) { callback(obj); });
							});
						}
					}).then(function(diffid) { 
						console.info('standingQuery() got diffid >> ', diffid);
						d.resolve({
							diffid: function() { return diffid; },
							stop:function() { this_.wsh.unsubscribeDiffQuery(diffid);	}
						});
					}).fail(d.reject);
				}).fail(d.reject);
				return d.promise();
			},
			countQuery:function(queryPattern) {
				var d = u.deferred();
				var k = _(queryPattern).keys()[0]; // select one key
				this.query(queryPattern,[k]).then(function(x) {
					// console.log('countQuery got results >> ', x, _(x.data).size());
					d.resolve(_(x.data).size());
				}).fail(d.reject);
				return d.promise();
			},
			///@arg {string} user : ID of user to give access to, or undefined for unauth_user
			///@arg {{read:{boolean}, write:{boolean}, owner:{boolean}, control: false} : Access control list for letting the specified user read, write, own and change ta box
			///Sets the ACL for this whole box. The acl object takes keys 'read', 'write', 'owner', and 'control'
			///each which take a boolean value
			///TODO: object-level access control
			///@then() : Success continuation when this has been set
			///@fail({error object}) : Failure continuation
			EVERYBODY:'##__everybody__##',
			setACL:function(user,acl) {
				var validKeys = ['read','write','owner','control'];
				u.assert( _.isString(user), "User must be a string");
				acl = acl && _.isObject(acl) || {};
				_(acl).map(function(v,k) { u.assert(validKeys.indexOf(k) >= 0, "type " + k + " is not a valid acl type"); });
				var perms = {read:false,write:false,owner:false,control:false};
				_(perms).extend(acl);
				var params = {
					acl:JSON.stringify(perms), 
					target_username: user !== this.EVERYBODY ? user : undefined, 
					unauth_user:user === this.EVERYBODY
				};
				return this._ajax("GET", [this.getID(), 'set_acl'].join('/'), params);
			},
			///@arg {string} user : ID of user to get access control list for
			///Gets the access control list of user, if specified, for this box or the box's entire ACL listings
			///@then({userid: { read:{boolean},write:{boolean},owner:{boolean},control:{boolean}}) : Access control listings for this box organised by user
			///@fail({error object}) : Failure
			getACL:function() {
				var d = u.deferred();
				this._ajax("GET", [this.getID(), 'get_acls'].join('/')).then(function(response) {
					if (response.code == 200) {
						return d.resolve(u.dict(response.data.data.map(function(x) { return [x.username, x.acl]; })));
						// return d.resolve(response.data);
					}
					d.reject(d.message);
				}).fail(d.reject);
				return d.promise();
			},
			// handles updates from websockets the server
			_diffUpdate:function(response) {
				console.debug("diffUpdate > ", response);
				var d = u.deferred(), this_ = this, latestVersion = response['@to_version'],
				addedIDs  = _(response.data.added).keys(),
				changedIDs = _(response.data.changed).keys(),
				deletedIDs = _(response.data.deleted).keys(),
				changedObjs = response.data.changed;

				u.assert(latestVersion !== undefined, 'latest version not provided');
				u.assert(addedIDs !== undefined, 'addedIDs not provided');
				u.assert(changedIDs !== undefined, 'changed not provided');
				u.assert(deletedIDs !== undefined, 'deleted _ids not provided');

				if (latestVersion <= this_.getVersion()) {
					u.debug('asked to diff update, but already up to date, so just relax!', latestVersion, this_.getVersion());
					return d.resolve();
				}
				// u.debug('setting latest version >> ', latest_version, added_ids, changed_ids, deleted_ids);
				console.info('diff setVersion, ', latestVersion, ' +/c/-: ', addedIDs, changedIDs, deletedIDs );
				this_._setVersion(latestVersion);
				this_._updateObjectList(undefined, addedIDs, deletedIDs);
				var changed = _(changedObjs).map(function(obj, uri) {
					// u.debug(' checking to see if in --- ', uri, this_._objcache().get(uri));
					// u.debug('obj >> ', obj);
					var cached_obj = this_._objcache().get(uri), cdfd = u.deferred();
					if (cached_obj) {
						// { prop : [ {sval1 - @type:""}, {sval2 - @type} ... ]
						var changedprops = [];
						var deleted = _(obj.deleted).map(function(vs, k) {
							changedprops.push(k);
							var dd = u.deferred();
							u.when(vs.map(function(v) {	return deserialiseValue(v, this_);	})).then(function(values) {
								var newVals = _(cached_obj.get(k) || []).difference(values);
								cached_obj.set(k,newVals);
								// semantics - if a property has no value then we delete it
								if (newVals.length === 0) { cached_obj.unset(k); }
								dd.resolve();
							}).fail(dd.reject);
							return dd.promise();
						});
						var added = _(obj.added).map(function(vs, k) {
							changedprops.push(k);
							var dd = u.deferred();
							u.when(vs.map(function(v) {	return deserialiseValue(v, this_);	})).then(function(values) {
								var newVals = (cached_obj.get(k) || []).concat(values);
								cached_obj.set(k,newVals);
								dd.resolve();
							}).fail(dd.reject);
							return dd.promise();
						});
                        var replaced = _(obj.replaced).map(function(vs, k) {
                            changedprops.push(k);
                            var dd = u.deferred();
                            u.when(vs.map(function(v) { return deserialiseValue(v, this_); })).then(function(values) {
                                var newVals = values; // this is the difference from added - just replace (by DS)
                                cached_obj.set(k,newVals);
                                dd.resolve();
                            }).fail(dd.reject);
                            return dd.promise();
                        });
                        console.debug('dfdlengths >> ', added.length, ' - ', deleted.length, ' ', replaced.length);
                        u.when(added.concat(deleted).concat(replaced)).then(function() {
							// u.debug("triggering changed properties ", changedprops);
							console.debug('changedprops ', changedprops, ' ', u.uniqstr(changedprops));
							u.uniqstr(changedprops).map(function(k) {
								cached_obj.trigger('change:'+k, cached_obj, (cached_obj.get(k) || []).slice());
								// u.debug("trigger! change:"+k);
							});
							cdfd.resolve(cached_obj);
						}).fail(cdfd.reject);
						return cdfd.promise();
					}
				});
				u.when(changed).then(d.resolve).fail(d.reject);
				return d.promise();
			},
			_createModelForID: function(objid){
				var model = new Obj({"@id":objid}, {box:this});
				this._objcache().add(model);
				return model;
			},
			obj:function(objid) {
				// proxy version
				var dfd = this.getObj(objid);
				return new ObjProxy(dfd);
			},
			/// @arg {string|string[]} objid - id or ids of objects to retrieve
			/// retrieves all of the objects by their ids specified from the server into the cache if not loaded, otherwise just returns the cached models
			/// @then({Obj|Obj[]} Array of loaded objects)
			/// @fail({string} Error raised during process)
			getObj:function(objid) {
				// getObj always returns a promise
				// console.debug(' getObj() >> ', objid);

				u.assert(typeof objid === 'string' || typeof objid === 'number' || _.isArray(objid), "objid has to be a number or string or an array of such things");

				var ids = _.isArray(objid) ? objid : [objid], this_ = this,
					fetching = {}, newids = [], skeletons = {}, objcache = this._objcache(),
					chunkN = 5000;

				var deserialise_obj = function(id, skelmodels, deferredset, newids_) {
					if (skelmodels[id] !== undefined) { 
						return skelmodels[id];
					}					
					// if not currently fetching but already fetched ... 
					var cachedobj;
					if ((cachedobj = objcache.get(id)) !== undefined) { 
						// deferredset[id] = u.dresolve(cachedobj); // create a new placeholder 
						skelmodels[id] = cachedobj;						
						return cachedobj; 
					}
					// we have someone new 
					skelmodels[id] = this_._createModelForID(id);
					deferredset[id] = u.deferred(); // create a new placeholder 
					newids_.push(id);
					return skelmodels[id];
				};
				var deserialise = function(s_obj, into_model, deferredset, silent, skels, newids_) {
					// resolves all of the properties into things that we have or
					// know about
					_(s_obj).map(function(vals, key) {
						if (key.indexOf('@') === 0) { return; } // skip "@id" etc etc
						var kd = u.deferred();
						// values for keys
						var values = vals.map(function(val) {	
							// object
							if (val.hasOwnProperty('@id')) { 
								return deserialise_obj(val['@id'], skels, deferredset, newids_);
							}
							// literal
							else if (val.hasOwnProperty("@value")) { 
								return deserialiseLiteral(val, this_.box);		
							}
							// unknown
							console.error('couldnt deserialise ', val);
							return undefined;
						});
						into_model.set(key,values,{silent: silent});
					});					
				};

				var fetch = function(ids, skels, deferredset, newids_) {
					var d = u.deferred();
					var tstart = new Date().valueOf();
					// console.log('asking to get >> ', ids);					
					this_._ajax('GET', this_.getID(), {'id':ids}).then(function(response) { 
						// console.log('got them , time ', (new Date()).valueOf() - tstart);
						console.log('fetch response >> ', response);
						_(response.data.data).map(function(mraw,id) {
							if (id[0] === '@') { return; }
							var _d = u.deferred();
							deserialise(mraw, skels[id], deferredset, true, skels, newids_);
							deferredset[id].resolve(skels[id]);
						});
						// new objects that we ask for don't get returned 
						ids.map(function(id) { 
							if (response.data.data[id] === undefined) { 
								deferredset[id].resolve(skels[id]); 
							}
						});
						d.resolve();
					}).fail(function(e) { 
						console.error('error with ajax ', ids); 
						d.reject();
					});
					return d.promise();
				};

				// prime the newids with all of the next guys we have to fetch
				ids.map(function(id) { 
					deserialise_obj(id, skeletons, fetching, newids); 
				});
				var ds = _(fetching).values();

				var recurse = function(ids) { 
					if (ids.length === 0) return u.dresolve();
					var idchunk = newids.splice(0,chunkN);
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
						u.when(ds).then(function() { d0.resolve(objid.map(function(id) { return skeletons[id]; }));}).fail(d0.reject); 
					} else {
						u.when(ds).then(function(v) { d0.resolve(skeletons[objid]); }).fail(d0.reject);
					}
				}).fail(d0.reject);
				return d0.promise();
			},
			// ----------------------------------------------------
			_updateObjectList:function(updatedObjIDs, added, deleted) {
				var current, olds = this._objlistdict(), this_ = this, news, died;
				// u.debug('_updateObjectList +', added ? added.length : ' ', '-', deleted ? deleted.length : ' ');
				// u.debug('_updateObjectList +', added || ' ', deleted || ' ');
				if (updatedObjIDs === undefined ) {
					_(olds).extend(added);
					if (deleted) { deleted.map(function(d) { delete olds[d]; }); }
					// current = _(u.uniqstr(olds.concat(added))).difference(deleted); //_(olds).chain().union(added).difference(deleted).value();
					news = (added || []).slice(); died = (deleted || []).slice();
					this._setObjListfromDict(olds);
				} else {
					// only during fetch
					current = updatedObjIDs.slice();
					news = _(current).filter(function(fid) { return !(fid in olds); }); // difference(olds);
					died = [];
					// not used 
					// console.info('warning: slow operation');
					// died = _(_(olds).keys()).difference(current);
					console.debug('setobjlistfromlist >> ', current.length);
					this._setObjDictfromList(current);
				}

				// u.debug('old objlist had ', olds.length, ' new has ', current.length, 'news > ', news);
				news.map(function(aid) { this_.trigger('obj-add', aid);	});
				died.map(function(rid) {
					this_.trigger('obj-remove', rid);
					this_._objcache().remove(rid);
				});			
			},
			_fetch:function() {
				// all fetch really does is retrieve ids!
				// new client :: this now _only_ fetches object ids
				// return a list of models (each of type Object) to populate a GraphCollection
				console.log('_ fetch ');
				var d = u.deferred(), this_ = this, fd = u.deferred();
				var box = this.getID();
				this._ajax("GET",[box,'get_object_ids'].join('/')).then(
					function(response){
						var data = response && response.data;
						// Dear DAN, there something very inconsistent here ----------
						// if (data && data.data) {
						// 	console.log('DOUBLE NESTED DATA ', response);
						// 	data = data.data;
						// } else {
						// 	console.log('single nested data ', response);
						// }
						u.assert(data['@version'] !== undefined, 'no version provided');
						this_.id = this_.getID(); // sets so that _isFetched later returns true
						console.info('_fetch setVersion ', data['@version']);
						this_._setVersion(data['@version']);
						this_._updateObjectList(data.ids);
						fd.resolve(this_);
					}).fail(fd.reject);				
				fd.then(function() {
					this_.trigger('update-from-master', this_.getVersion());
					d.resolve(this_);
				}).fail(d.reject);
				return d.promise();
			},
			// -----------------------------------------------
			_createBox:function() {
				var d = u.deferred();
				var this_ = this;
				this.store._ajax('POST', 'admin/create_box', { name: this.getID() } )
					.then(function() {
						this_.fetch().then(function() { d.resolve(); }).fail(function(err) { d.reject(err); });
					}).fail(function(err) { d.reject(err); });
				return d.promise();
			},
			deleteBox:function(boxid) {
				return this.store._ajax('POST','admin/delete_box', { name: boxid } );
			},
			// =============== :: UPDATE ::  ======================
			WHOLE_BOX: "__UPDATE__WHOLE__BOX__",
			_addToUpdateQueue:function(idsToUpdate) {
				var this_ = this, uq = this._updateQueue;
				// returns the deferreds
				idsToUpdate = idsToUpdate === undefined ? [ this.WHOLE_BOX ] : idsToUpdate;
				return idsToUpdate.map(function(id) {
					uq[id] = uq[id] || u.deferred();
					return uq[id];
				});
			},
			_requeueUpdate:function() {
				var this_ = this;
				this.once('update-from-master', function() { this_._flushUpdateQueue(); });
				// if (!this._updateTimeout) {
				// 	this._updateTimeout = setTimeout(function() {
				// 		delete this_._updateTimeout;
				// 		this_._flushUpdateQueue();
				// 	}, 1000);
				// }
			},
			_flushUpdateQueue:function() {
				var this_ = this, uq = this._updateQueue, idsToUpdate = _(uq).keys();
				if (idsToUpdate.length === 0) { return ; }
				if (this._updating || this._deleting) {
					return this._requeueUpdate();
				}

				this._updateQueue = {};
				var updateArguments = idsToUpdate.indexOf(this.WHOLE_BOX) >= 0 ? undefined : idsToUpdate;
				this_._updating = true;

				this_._doUpdate(updateArguments).then(function() {
					delete this_._updating;
					// TODO: resolve all of our deferreds now and delete them
					idsToUpdate.map(function(id) { uq[id].resolve();	});
				}).fail(function(err) {
					delete this_._updating;
					if (err.status === 409) {
						// add the deferreds back in
						_(uq).map(function(d,id) {
							if (this_._updateQueue[id]) {
								// someone's already added one back in! let's chain them
								u.debug('HEYYYYYYYYYYYYYYYYYYYYYY already added in - lets go');
								this_._updateQueue[id].then(uq[id].resolve).fail(uq[id].reject);
							} else {
								u.debug('sneaking him back in - lets go');
								this_._updateQueue[id] = uq[id];
							}
						});
						return this_._requeueUpdate();
					}
					// something bad happened, we'd better reject on those deferreds
					u.error('UPDATE error ', err);
					idsToUpdate.map(function(id) { uq[id].reject(err);});
				});
			},
			_doUpdate:function(ids) {
				// this actua
				var d = u.deferred(), version = this.getVersion() || 0, this_ = this, oc = this._objcache(),
				objs = (ids === undefined ? oc.values() : ids.map(function(id) { return oc.get(id); })), // this._objcache().filter(function(x) { return ids === undefined || ids.indexOf(x.id) >= 0; }),
				objIDs = (ids === undefined ? oc.keys() : ids.slice()), // objs.map(function(x) { return x.id; }),
				sobjs = objs.map(function(obj){ return serialiseObj(obj); });
				this._ajax("PUT",  this.getID() + "/update", { version: escape(version), data : JSON.stringify(sobjs)  })
					.then(function(response) {
						this_._setVersion(response.data["@version"]);
						var dobjlist = this_._objlistdict(); 
						var newids = _(objIDs).filter(function(oid) { return !(dobjlist[oid]); });
						if (newids.length) {
							// update objectlist
							this_._updateObjectList(undefined, newids, []);
						}
						d.resolve(this_);
					}).fail(d.reject);
				return d.promise();
			},
			_save_queue : [],
			_simpleUpdate:function(obj) {

				var d = u.deferred(), 
					version = this.getVersion() || 0, 
					this_ = this, 
					oc = this._objcache(),
					objID = obj.id,
					sobj = serialiseObj(obj);

				this._ajax("PUT",  this.getID() + "/update", { version: escape(version), data : JSON.stringify([sobj])  })
					.then(function(response) {
						// console.log('PUT response response >> ', response);
						this_._setVersion(response.data.data["@version"]);
						var dobjlist = this_._objlistdict(); 
						if (!dobjlist[objID]) {
							this_._updateObjectList(undefined, [objID], []);
						}
						d.resolve(this_);
					}).fail(function(err) { 
						console.log('save errr ', err);
						if (err.code == 409) { 
							// ----- 
							console.info('obsolete postponing save .. ');
							this_.once('diff', function() { 
								console.info('got diff update, attempting resave of ', obj.id);
								this_._simpleUpdate(obj).then(function() { 
									console.info('resumed save succeeded for ', obj.id);
									d.resolve(obj);
								}).fail(d.reject);
							});
						} else {
							// some other error
							d.reject(err);
						}
					});
				return d.promise();
			},
			_update:function(originalIDs) {
				// this is called by Backbone.save(),
				var dfds = this._addToUpdateQueue(originalIDs);
				this._flushUpdateQueue();
				return dfds;
			},
			// =============== :: DELETE ::  ======================
			_addToDeleteQueue:function(ids) {
				var this_ = this, dq = this._deleteQueue;
				return ids.map(function(id) {
					dq[id] = dq[id] || u.deferred();
					return dq[id];
				});
			},
			_deleteModels:function(ids) {
				var dfds =  this._addToDeleteQueue(ids);
				this._flushDeleteQueue();
				return dfds;
			},
			_requeueDelete:function() {
				var this_ = this;
				this.once('update-from-master', function() { this_._flushDeleteQueue();	});
				// if (!this._deleteTimeout) {
				// 	this._deleteTimeout = setTimeout(function() {
				// 		delete this_._deleteTimeout;
				// 		this_._flushDeleteQueue();
				// 	}, 300);
				// }
			},
			_flushDeleteQueue:function() {
				var this_ = this, dq = this._deleteQueue, deleteIDs = _(dq).keys();
				if (deleteIDs.length === 0) { return ; }
				if (this._deleting || this._updating) { return this._requeueDelete();  }
				this_._deleting = true;
				this_._doDelete(deleteIDs).then(function() {
					delete this_._deleting;
					deleteIDs.map(function(id) {
						dq[id].resolve(); delete dq[id];
					});
				}).fail(function(err) {
					delete this_._deleting;
					if (err.status === 409) { this_._requeueDelete();	}
				});
			},
			_doDelete:function(mIDs) {
				var version = this.get('version') || 0, d = u.deferred(), this_ = this;
				this._ajax('DELETE', this.id+'/', { version:version, data: JSON.stringify(mIDs) })
					.then(function(response) {
						u.debug('DELETE response NEW version > ', response.data.data["@version"]);
						this_._setVersion(response.data.data["@version"]);
						this_._updateObjectList(undefined, [], mIDs); // update object list
						d.resolve(this_);
					}).fail(d.reject);
				return d.promise();
			},
			// =============== :: SYNC ::  ======================
			sync: function(method, box, options){
				switch(method)
				{
				case "create": return box._createBox();
				case "read": return box._prefetch(); // box._checkTokenAndFetch();
				case "update": return box._update()[0];  // save whole box?
				case "delete": return this.deleteBox(this.getID()); // hook up to destroy
				}
			},
			toString: function() { return 'box:' + this.getID(); }
		});

		var BoxCollection = Backbone.Collection.extend({ model: Box });

		var Store =  Backbone.Model.extend({
			defaults: {
				server_host:DEFAULT_HOST,
				app:"--default-app-id--"
			},
			ajaxDefaults : {
				jsonp: false, contentType: "application/json",
				xhrFields: { withCredentials: true }
			},

			/// @opt {Object} attributes
			/// @opt {Object} options
			/// @construct
			initialize: function(attributes, options){
				this.set({boxes : new BoxCollection([], {store: this})});

			},

			/// Check that the
			isSameDomain:function() {
				return this.get('server_host').indexOf(document.location.host) >= 0 && (document.location.port === (this.get('serverPort') || ''));
			},
			boxes:function() { return this.attributes.boxes;	},
			getBox: function(boxid) {
				var b = this.boxes().get(boxid) || this._create(boxid), 
					this_ = this,
					d = u.deferred();
				if (b.wsh) {
					console.log('connected already! resolving straightaway --- ');
					return u.dresolve(b); 
				}
				// get ws connected
				b.wsh = new indxws.Handler({store: this, box:b});
				window.wsh = b.wsh;
				b.wsh.getReadyD().then(function() {
					console.log('websocket ready!');
					b._fetch().then(d.resolve).fail(d.reject);
				}).fail(function() { 
					console.log('readyd failed ');
					b.wsh = undefined;
					d.reject();
				});
				return d.promise();
			},
			box:function(boxid) {
				return new BoxProxy(this.getBox(boxid));
			},
			/// @arg <string|number> boxid: the id for the box
			/// Creates a box with id boxid.  The user should have appropriate permissions
			/// to create a box first.
			/// @then({Box} the box)
			/// @fail({{ code: 409 }} response) - box already exists
			/// @fail({{ code: -1, error: errorObj }} response) - other error
			///
			/// Attempts to create a box with the given ID
			createBox: function (boxid) {
				u.debug('create box ', boxid);
				if (this.boxes().get(boxid)) {
					return u.dreject({ code: 409, message: 'Box already exists: ' + boxid });
				}
				var c = this._create(boxid), this_ = this;
				u.debug('creating ', boxid);
				return c.save().pipe(function() { return this_.getBox(boxid); });
			},
			createUser : function(username,password) {
				return this._ajax('POST', 'admin/create_user', { username: username, password: password });
			},
			/// Called by apps to see if we are currently authenticated; this is the preferred
			/// method to do so over login()/loginOpenID(), which potentially destroys/resets cookies.
			/// Instead, this method interrogates the server, which implicitly passes cookies if we have them
			/// and is verified against the server's set.  If we do have cookies, the server essentially tells
			/// us we're still logged in, so we can proceed from there....
			/// @then({is_authenticated:true/false}) - Returns true/false depending on auth status
			/// @fail(<String>) Error raised during process
			checkLogin:function() {
				// TODO: fix this to set the credentials if we don't know who we are
				var d = u.deferred(), this_ = this;
				this._ajax('GET', 'auth/whoami').then(function(response) {
					if (response.is_authenticated) {
						// make user
						var user = {'@id': response.username, type:response.type, name:response.username };
						if (response.user_metadata) { _(user).extend(JSON.parse(response.user_metadata)); }
						u.assert(response.username, "No username returned from whoami, server problem");
						u.assert(response.type, "No user_type returned from whoami, server problem");
						this_.set({username:response.username, user_type:response.type});
						// this_.trigger('login', user);
						var toReturn = _({}).chain().extend(response).extend(user).value();
						return d.resolve(toReturn);
					}
					d.resolve(response);
				}).fail(function() { d.reject.apply(d,arguments); });
				return d.promise();
			},
			/// returns info of current logged in user
			/// @then(<Obj>) - All currently known info about the user
			/// @fail(<String>) Error raised during process
			getInfo:function() { return this._ajax('GET', 'admin/info'); },
			/// @arg <string> openid: The OpenID to log in as
			/// This method initiates a redirect of the current page
			/// @then(<Obj>) - Continuation with openid success/fail
			/// @fail(<String>) Error raised during process
			loginOpenID : function(openid) {
				var this_ = this, d = u.deferred(), popup, intPopupChecker;
				window.__indxOpenidContinuation = function(response) {
					console.info("openid continuation >> ", response);
					var getparam = function(pname) { return u.getParameterByName(pname, '?'+response); };
					var username = getparam('username');
					if (username) {
						var userType = getparam('username_type'),
							user = {'@id':username, type:userType, name:username},
							userMetadata = getparam('user_metadata');
						if (userMetadata) {
							u.log('userMetadata', userMetadata, typeof userMetadata);
							try {
								userMetadata = JSON.parse(userMetadata);
								_(user).extend(userMetadata);
								console.debug('user is now --' , user);
							} catch(e) { console.error('error parsing json, no biggie', userMetadata);	}
						}
						u.log('logging in user >>', user);
						this_.trigger('login', user);
						this_.set({user_type:'openid',username:openid});
						console.debug('successful login! setting user type OPENID, id', this_.get('user_type'), " - ", this_.get('username'));
						return d.resolve(user);
					}
					d.reject({message:'OpenID authentication failed', status:0});
				};
				// console.debug('login openid >>> ', this._getBaseURL());
				var url = [this._getBaseURL(), 'auth', 'login_openid'].join('/');
				var redirURL = [this._getBaseURL(), 'openid_return_to.html'].join('/');
				// console.debug('redir url ', redirURL);
				var params = { identity: encodeURIComponent(openid), redirect:encodeURIComponent(redirURL) };
				url = url + "?" + _(params).map(function(v, k) { return k+'='+v; }).join('&');
				// console.info('OpenID :: opening url >>', url);
				popup = window.open(url, 'indx_openid_popup', 'width=790,height=500');
				intPopupChecker = setInterval(function() {
					if (!popup.closed) { return; }
					if (d.state() !== 'pending') {
						// success/failure has been achieved, just continue
						// console.info('popup closed naturally, continuing');
						clearInterval(intPopupChecker);
						return;
					}
					// console.error('popup force closed, continuing reject');
					// popup force closed
					clearInterval(intPopupChecker);
					d.reject({status:0, message:"Cancelled"});
				});
				return d.promise();
			},
			/// @arg <string> username: username to log in as
			/// @arg <string> password: password to use for auth
			/// Local Login - logs in using the traditional (local user) method
			/// @then(<Obj>) - Continuation with logged in username
			/// @fail(<String>) Error raised during process
			login : function(username,password) {
				// local user method
				var d = u.deferred();
				var this_ = this;
				this._ajax('POST', 'auth/login', { username: username, password: password })
					.then(function(l) {
						var localUser =  _makeLocalUser(username);
						this_.set({user_type:'local',username:username,password:password});
						this_.trigger('login', localUser);
						d.resolve(localUser);
					}).fail(function(l) { d.reject(l); });
				return d.promise();
			},
			reconnect:function() {
				if (this.get('user_type') === 'openid') {
					u.log('reconnecting as openid ', this.get('username'));
					return this.loginOpenID(this.get('username'));
				}
				u.log('reconnecting as local ', this.get('username'), this.get('password'));
				return this.login(this.get('username'),this.get('password'));
			},
			disconnect:function() {
				return this.attributes.boxes.map(function(b) { b.disconnect(); });
			},
			isConnected:function() {
				return this.attributes.boxes.map(function(b) {
					return { box: b.id, connected: b.isConnected() };
				});
			},
			/// Logs out local and remote users
			/// @then(): Logout complete
			/// @fail(): Logout failed
			logout : function() {
				console.debug('store --- logout');
				var d = u.deferred();
				var this_ = this;
				this._ajax('POST', 'auth/logout')
					.then(function(l) { this_.trigger('logout'); d.resolve(l); })
					.fail(function(l) { d.reject(l); });
				return d.promise();
			},
			_create:function(boxid) {
				var b = new Box({}, {store: this});
				b.cid = boxid;
				this.boxes().add(b);
				return b;
			},
			getBoxList:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_boxes')
					.then(function(data) {d.resolve(data.list);})
					.fail(function(err) { d.reject(err); });
				return d.promise();
			},
			getUserList:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_users')
					.then(function(data) { 
						var users = data.users;
						users.map(function(u) {
							if (u.user_metadata && typeof u.user_metadata === 'string') {
								_(u).extend(JSON.parse(u.user_metadata));
								delete u.user_metadata;
							} else if (u.user_metadata && typeof u.user_metadata === 'object') {
								_(u).extend(u.user_metadata);
								delete u.user_metadata;
							}							
							if (!u.name) {
								var id = u["@id"];
								if (id.indexOf('http') === 0) {
									id = id.split('/');
									id = id[id.length-1];
								}
								u.name = id;
							}
						});
						d.resolve(users);
					}).fail(function(err) { d.reject(err); });
				return d.promise();
			},
			getAppsList:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_apps')
					.then(function(data) { d.resolve(data.apps); })
					.fail(function(err) { d.reject(err); });
				return d.promise();
			},
			_fetch:function() {	throw new Error('dont fetch a store - any more!');	},
			_getBaseURLHelper:utils.memoise_fast1(function(server_host) {
				var url = server_host.indexOf('://') >= 0 ? server_host : [document.location.protocol, '', server_host].join('/');
				console.debug('executing getbaseurlhelper >> ', url);
				return url;
			}),
			_getBaseURL: function() {
				return this._getBaseURLHelper(this.get('server_host'));
			},
			_ajax:function(method, path, data) {
				// now uses relative url scheme '//blah:port/path';
				var url = [this._getBaseURL(), path].join('/');
				var defaultData = { app: this.get('app') };
				var options = _({}).extend(
					this.ajaxDefaults,
					{ url: url, type : method, crossDomain: !this.isSameDomain(), data: _({}).extend(defaultData,data) }
				);
				return ajax( options ); // returns a deferred
			},
			sync: function(method, model, options){
				switch(method){
				case "create": return u.error('store.create() : cannot create a store'); // TODO
				case "read"  : return model._fetch();
				case "update": return u.error('store.update() : cannot update a store'); // TODO
				case "delete": return u.error('store.delete() : cannot delete a store'); // tODO
				}
			}
		});
		var exports = {
			safeApply:utils.safeApply,
			u : utils,
			Store:Store,
			Obj: Obj,
			File:File,
			Box: Box,
			store: new Store(),
			loaded : utils.deferred()
		};
		window.u = utils;

		// do not fetch boxes
		exports.loaded.resolve(exports);
		return exports;

	}).factory('backbone', function(client, utils) {
		// this manages backbone-angular mystification
		var deregfns = [];
		var deepCloneObj = function(o) {
			return utils.dict(_(o).map(function(v,k) { return [k, v.concat()]; }));
		};
		var scopeBind = function($scope, name, model) {
			utils.assert(model instanceof Backbone.Model, "tried to bind something that was not a model");
			window._m = model;
			var clone = deepCloneObj(_(model.attributes));
			utils.safeApply($scope, function() { $scope[name] = clone;	});
			var findchanges = function(old,new_,fn) {
				var changes = [];
				_(old).map(function(v,k) {
					if (v.length !== new_[k].length || _(v).filter(function(vi, i) { return vi != new_[k][i]; }).length) {
						utils.log('pushing changes ', k, new_[k]);
						changes.push(k);
						if (fn) { fn(k,new_[k].concat()); }
					}
				});
				return changes;
			};
			// angular -> backbone
			var dereg = $scope.$watch(name, function() {
				// do a quick diff --
				// first check to make sure that our brave model is still
				if ($scope[name] !== clone) { return true; }
				findchanges(model.attributes, clone, function(k,v) {model.set(k,v); });
			}, true);
			deregfns.push([$scope,name,model,dereg]);
			// backbone -> angular
			model.on('change', function(data) {
				utils.safeApply($scope, function() {
					findchanges(clone, model.attributes, function(k,v) { clone[k] = v;	});
				});
			},$scope);
		};
		return {
			scopeBind: scopeBind,
			scopeUnbind:function($scope,name) {
				deregfns.map(function(tuple) {
					var scope = tuple[0],name = tuple[1],model = tuple[2],dereg = tuple[3];
					model.off('change', null, scope);
					dereg();
				});
			}
		};
	});
