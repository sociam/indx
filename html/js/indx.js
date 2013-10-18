/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true, todo:true */


///  @title indx.js
///
///  Javascript ORM client for INDX that makes it easy to
///  read and write objects from one or more INDX data store(s).

///  #### Copying
///  Copyright (C) 2011-2013 University of Southampton
///  Copyright (C) 2011-2013 Daniel Alexander Smith
///  Copyright (C) 2011-2013 Max Van Kleek
///  Copyright (C) 2011-2013 Nigel R. Shadbolt
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
	.factory('client',function(utils) {
		var u = utils, log = utils.log, error = utils.error, debug = utils.debug;
		var DEFAULT_HOST = document.location.host; // which may contain the port
		var WS_MESSAGES_SEND = {
			auth: function(token) { return JSON.stringify({action:'auth', token:token}); },
			diff: function(token) { return JSON.stringify({action:'diff', operation:"start"}); }
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
					if (val instanceof File) {
						obj_vals.push({"@value": val.id, "@type":"indx-file", "@language":val.get('content-type')});
					} else if (val instanceof Obj) {
						obj_vals.push({"@id": val.id });
					} else if (typeof val === "object" && (val["@value"] || val["@id"])) {
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
						u.warn("Could not determine type of val ", pred, val);
						obj_vals.push({"@value": val.toString()});
					}
				});
				out_obj[pred] = obj_vals;
			});
			out_obj['@id'] = uri;
			return out_obj;
		};

		var literal_deserializers = {
			'': function(o) { return o['@value']; },
			"http://www.w3.org/2001/XMLSchema#integer": function(o) { return parseInt(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#float": function(o) { return parseFloat(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#double": function(o) { return parseFloat(o['@value'], 10); },
			"http://www.w3.org/2001/XMLSchema#boolean": function(o) { return o['@value'].toLowerCase() === 'true'; },
			"http://www.w3.org/2001/XMLSchema#dateTime": function(o) { return new Date(Date.parse(o['@value'])); },
			"indx-file": function(o,box) {
				var f = box.get_or_create_file(o['@value']);
				f.set("content-type", o['@language']);
				return f;
			}
		};
		var deserialize_literal = function(obj, box) {
			return obj['@value'] !== undefined ? literal_deserializers[ obj['@type'] || '' ](obj, box) : obj;
		};

		var deserialize_value = function(s_val, box) {
			var vd = u.deferred();
			// it's an object, so return that
			if (s_val.hasOwnProperty("@id")) {
				// object
				box.get_obj(s_val["@id"]).then(vd.resolve).fail(vd.reject);
			}
			else if (s_val.hasOwnProperty("@value")) {
				// literal
				vd.resolve(deserialize_literal(s_val, box));
			}
			else {
				// don't know what it is!
				vd.reject('cannot unpack value ', s_val);
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
			get_id:function() { return this.id;	},
			get_url:function() {
				var params = {
					id:this.get_id(),
					app:this.box.store.get('app'),
					token:this.box.get('token'),
					box:this.box.get_id()
				}, url = ['/', this.box.store.get('server_host'), this.box.id, 'files'].join('/') + '?' + $.param(params);
				// u.debug("IMAGE URL IS ", url, params);
				return url;
			}
		});

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
			_is_fetched: function() { return this._fetched || false; },
			_set_fetched : function() { this._fetched = true; },
			get_id:function() { return this.id;	},
			_value_to_array:function(k,v) {
				if (k === '@id') { return v; }
				if (!_(v).isUndefined() && !_(v).isArray()) {
					return [v];
				}
				return v;
			},
			_all_values_to_arrays:function(o) {
				if (!_(o).isObject()) { utils.error(' not an object', o); return o; }
				var this_ = this;
				// ?!?! this isn't doing anything (!!)
				return u.dict(_(o).map(function(v,k) {
					var val = this_._value_to_array(k,v);
					if (u.defined(val)) { return [k,val]; }
					return undefined;
				}).filter(u.defined));
			},
			set:function(k,v,options) {
				// set is tricky because it can be called like
				// set('foo',123) or set({foo:123})
				if (typeof k === 'string') { v = this._value_to_array(k,v);	}
				else {	k = this._all_values_to_arrays(k);	}
				return Backbone.Model.prototype.set.apply(this,[k,v,options]);
			},
			delete_properties:function(props, silent)  {
				var this_ = this;
				props.map(function(p) { this_.unset(p, silent ? {silent:true} : {}); });
			},
			_deserialise_and_set:function(s_obj, silent) {
				// returns a promise
				var this_ = this;
				var dfds = _(s_obj).map(function(vals, key) {
					var kd = u.deferred();
					// skip "@id" etc etc
					if (key.indexOf('@') === 0) { return; }
					var val_dfds = vals.map(function(val) {
						var vd = u.deferred();
						// it's an object, so return that
						if (val.hasOwnProperty("@id")) {
							// object
							this_.box.get_obj(val["@id"]).then(vd.resolve).fail(vd.reject);
						}
						else if (val.hasOwnProperty("@value")) {
							// literal
							vd.resolve(deserialize_literal(val, this_.box));
						}
						else {
							// don't know what it is!
							vd.reject('cannot unpack value ', val);
						}
						return vd.promise();
					});
					u.when(val_dfds).then(function(obj_vals) {
						// only update keys that have changed
						var prev_vals = this_.get(key);
						if ( prev_vals === undefined || obj_vals.length !== prev_vals.length ||
							 _(obj_vals).difference(prev_vals).length > 0 ||
							 _(prev_vals).difference(obj_vals).length > 0) {
							this_.set(key, obj_vals, { silent : silent });
						}
						kd.resolve();
					}).fail(kd.reject);
					return kd.promise();
				}).filter(u.defined);
				return u.when(dfds);
			},
			_load_from_json: function(json) {
				var objdata = json, this_ = this;
				if (objdata['@version'] === undefined) {
					// then the server thinks we've been deleted, so let's just die.
					return u.dreject(this.id);
				}
				// we are at current known version as far as we know
				var obj_save_dfds = _(objdata).map(function(obj,uri) {
					// top level keys - corresponding to box level properties
					if (uri[0] === "@") { return; } // ignore "@id", "@version" etc
					// not one of those, so must be a
					// < uri > : { prop1 .. prop2 ... }
					u.assert(uri === this_.id, 'can only deserialise this object ');
					return this_._deserialise_and_set(obj);
				});
				return u.when(obj_save_dfds);
			},
			// this code path taken if someone just fetches one model directly using m.fetch()
			_fetch:function() {
				var this_ = this, fd = u.deferred(), box = this.box.get_id();
				this.box._ajax('GET', box, {'id':this.id}).then(function(response) {
					this_._set_fetched(true);
					this_._load_from_json(response.data)
						.then(function(){ fd.resolve(this_); }).fail(fd.reject);
				});
				return fd.promise();
			},
			sync: function(method, model, options){
				switch(method){
				case "create": return u.assert(false, "create is never used for Objs");
				case "read"  : return model._fetch();
				case "update":
					return  model.box._update([model.id])[0];
				case "delete":
					return this.box._delete_models([this.id])[0];
				}
			}
		});


		// Box =================================================
		// GraphCollection is the list of Objs in a Graph
		var ObjCollection = Backbone.Collection.extend({ model: Obj }),
			FileCollection = Backbone.Collection.extend({ model: File });

		// new client: fetch is always lazy, only gets ids, and
		// lazily get objects as you go
		var Box = Backbone.Model.extend({
			idAttribute:"@id",
			default_options: { use_websockets:true, ws_auto_reconnect:false	},
			/// @construct
			initialize:function(attributes, options) {
				var this_ = this;
				u.assert(options.store, "no store provided");
				this.store = options.store;
				this.set({objcache: new ObjCollection(), objlist: [], files : new FileCollection() });
				this.options = _(this.default_options).chain().clone().extend(options || {}).value();
				this._set_up_websocket();
				this._update_queue = {};
				this._delete_queue = {};
				this._fetching_queue = {};
				this.on('update-from-master', function() {
					// u.log("UPDATE FROM MASTER >> flushing ");
					this_._flush_update_queue();
					this_._flush_delete_queue();
				});
			},
			/// @arg {string} fid - file id
			/// Tries to get a file with given id. If it doesn't exist, a file with that name is created.
			/// @return {File} the file
			get_or_create_file:function(fid) {
				var files = this.get('files');
				if (files.get(fid) === undefined) {
					files.add(new File({"@id": fid}, { box: this }));
				}
				return files.get(fid);
			},
			_set_up_websocket:function() {
				var this_ = this, server_host = this.store.get('server_host');
				if (! this.get_use_websockets() ) { return; }
				this.on('new-token', function(token) {
					var ws = this_._ws;
					if (ws) {
						try {
							ws.close();
							delete this_._ws;
						} catch(e) { u.error(); }
					}
					var protocol = (document.location.protocol === 'https:') ? 'wss:/' : 'ws:/';
					var ws_url = [protocol,server_host,'ws'].join('/');
					ws = new WebSocket(ws_url);
/// @ignore
/// dhjo
					ws.onmessage = function(evt) {
						u.debug('websocket :: incoming a message ', evt.data.toString().substring(0,190));
						var pdata = JSON.parse(evt.data);
						if (pdata.action === 'diff') {
							this_._diff_update(pdata.data)
								.then(function() {
									this_.trigger('update-from-master', this_.get_version());
								}).fail(function(err) {
									u.error(err); /*  u.log('done diffing '); */
								});
						}
					};
					/// @arg {blah} - sfd
					/// fdsafds
					ws.onopen = function() {
						var data = WS_MESSAGES_SEND.auth(this_.get('token'));
						ws.send(data);
						data = WS_MESSAGES_SEND.diff();
						ws.send(data);
						this_._ws = ws;
						this_.trigger('ws-connect');
					};
					/// @ignore
					ws.onclose = function(evt) {
						// what do we do now?!
						u.error('websocket closed -- ');
						// TODO
						var interval;
						interval = setInterval(function() {
							this_.store.reconnect().then(function() {
								this_.get_token().then(function() {
									clearInterval(interval);
								});
							});
						},1000);
					};
				});
			},
			/// Gets whether the option to use websockets has been set; set this option using the store's options.use_websockets;
			/// @return {boolean} - Whether will try to use websockets.
			get_use_websockets:function() { return this.options.use_websockets; },
			/// Returns C, the number of objects that have been loaded from the server. Necessararily C < get_obj_ids.length()
			/// @return {integer} - Number of objects in the cache
			get_cache_size:function() { return this._objcache().length; },
			/// Gets all of the ids contained in the box
			/// @return {string[]} - Set of IDs
			get_obj_ids:function() { return this._objlist().slice(); },
			_objcache:function() { return this.attributes.objcache; },
			_objlist:function() { return this.attributes.objlist !== undefined ? this.attributes.objlist : []; },
			_set_objlist:function(ol) { return this.set({objlist:ol.slice()}); },
			_get_cached_token:function() { return this.get("token"); },
			_set_token:function(token) { this.set("token", token);	},
			_set_version:function(v) { this.set("version", v);	},

			/// @return {integer} - Current version of the box
			/// gets the current version of this box
			get_version:function() { return this.get("version"); },

			/// @then({Box}) - gets a token for this box and continues
			/// @fail({Error}) - returns the raised error
			/// Gets an auth token for the box. This is done automatically
			/// by a store when constructed by get_box.
			get_token:function() {
				// utils.debug('>> get_token ', ' id: ',this.id, ' cid: ',this.cid);
				// try { throw new Error(''); } catch(e) { console.error(e); }
				var this_ = this, d = u.deferred();
				this._ajax('POST', 'auth/get_token', { app: this.store.get('app') })
					.then(function(data) {
						debug('setting token ', data.token);
						this_._set_token( data.token );
						this_.trigger('new-token', data.token);
						d.resolve(this_);
					}).fail(d.reject);
				return d.promise();
			},
			/// Gets this box's id
			/// @return {integer} - this box's id
			get_id:function() { return this.id || this.cid;	},
			_ajax:function(method, path, data) {
				data = _(_(data||{}).clone()).extend({box: this.id || this.cid, token:this.get('token')});
				return this.store._ajax(method, path, data);
			},
			/// @arg {string} id - Identity to use for hte file
			/// @arg {HTML5File} filedata - HTML5 File object to put
			/// @arg {string} contenttype - Content type to store with the file (for use in serving back)
			/// uploads the file identified by file into the box, watching out for obsolete messages.
			/// Handles obsolete cases by merely waiting for a websocket update
			/// @then({INDX.File}) - returns created File object
			/// @fail(error) - returns Error object
			put_file:function(id,filedata,contenttype) {
				// creates a File object and hands it back in the resolve
				contenttype = contenttype || filedata.type;
				var d = u.deferred(), this_ = this, newFile = this.get_or_create_file(id);
				newFile.set({"content-type": contenttype});
				this._do_put_file(id,filedata,contenttype).then(function(){
					u.debug('image put success ');
					d.resolve(newFile);
				}).fail(function(err) {
					if (err.status === 409) {
						/// @ignore
						var cb = function() {
							this_.off('update-from-master', cb, newFile);
							this_._put_file(id, filedata, contenttype).then(d.resolve).fail(d.reject);
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
			_do_put_file:function(id,file,contenttype) {
				var boxid = this.id || this.cid,
				base_url = ['/', this.store.get('server_host'), boxid, 'files'].join('/'),
				options = { app: this.store.get('app'), id: id, token:this.get('token'),  box: boxid, version: this.get_version() },
				option_params = $.param(options),
				url = base_url+"?"+option_params,
				d = u.deferred();
				debug("PUTTING FILE ", url);
				var ajax_args  = _(_(this.store.ajax_defaults).clone()).extend(
					{ url: url, method : 'PUT', crossDomain:false, data:file, contentType: contenttype, processData:false }
				);
				return $.ajax( ajax_args );
			},
			/// @arg {Object} query_pattern - a query pattern to match
			/// @opt {string[]} predicates - optional array of predicates to return, or entire objects otherwise
			///
			/// Issues query to server, which then returns either entire objects or just values of the props specified
			///
			/// @then({Objs[]} Objects matching query) - When the query is successful
			/// @fail({string} Error) - When the query fails
			query: function(query_pattern, predicates){
				// @param - query_pattern is an object like { key1 : val1, key2: val2 } .. that
				//   returns / fetches all objects
				var d = u.deferred();
				var cache = this._objcache();
				var parameters = {"q": JSON.stringify(query_pattern)};
				var this_ = this;
				if (predicates) {
					_(parameters).extend({predicate_list: predicates });
					console.log('new query pattern >> ', parameters);
				}
				this._ajax("GET", [this.id, "query"].join('/'), parameters)
					.then(function(results) {
						if (predicates) {
							// raw partials just including predicates - these are not whole
							// objects
							return d.resolve(results);
						}
						console.log('results >> ', results.data);
						// otherwise we are getting full objects, so ...
						d.resolve(_(results.data).map(function(dobj,id) {
							console.log('getting id ', id);
							if (cache.get(id)) { console.log('cached! ', id); return cache.get(id); }
							console.log('not cached! ', id);
							var model = this_._create_model_for_id(id);
							model._deserialise_and_set(dobj, true);
							return model;
						}));
					}).fail(function(err) { error(err); d.reject(err); });
				return d.promise();
			},
			// handles updates from websockets the server
			_diff_update:function(response) {
				var d = u.deferred(), this_ = this, latest_version = response['@to_version'],
				added_ids  = _(response.data.added).keys(),
				changed_ids = _(response.data.changed).keys(),
				deleted_ids = _(response.data.deleted).keys(),
				changed_objs = response.data.changed;

				u.assert(latest_version !== undefined, 'latest version not provided');
				u.assert(added_ids !== undefined, 'added_ids not provided');
				u.assert(changed_ids !== undefined, 'changed not provided');
				u.assert(deleted_ids !== undefined, 'deleted _ids not provided');

				if (latest_version <= this_.get_version()) {
					u.debug('asked to diff update, but already up to date, so just relax!', latest_version, this_.get_version());
					return d.resolve();
				}
				u.debug('setting latest version >> ', latest_version, added_ids, changed_ids, deleted_ids);
				this_._set_version(latest_version);
				this_._update_object_list(undefined, added_ids, deleted_ids);
				var change_dfds = _(changed_objs).map(function(obj, uri) {
					u.debug(' checking to see if in --- ', uri, this_._objcache().get(uri));
					u.debug('obj >> ', obj);
					var cached_obj = this_._objcache().get(uri), cdfd = u.deferred();
					if (cached_obj) {
						// { prop : [ {sval1 - @type:""}, {sval2 - @type} ... ]
						var changed_properties = [];
						var deleted_propval_dfds = _(obj.deleted).map(function(vs, k) {
							changed_properties = _(changed_properties).union([k]);
							var dd = u.deferred();
							u.when(vs.map(function(v) {	return deserialize_value(v, this_);	})).then(function(values) {
								var new_vals = _(cached_obj.get(k) || []).difference(values);
								cached_obj.set(k,new_vals);
								// semantics - if a property has no value then we delete it
								if (new_vals.length === 0) { cached_obj.unset(k); }
								dd.resolve();
							}).fail(dd.reject);
							return dd.promise();
						});
						var added_propval_dfds = _(obj.added).map(function(vs, k) {
							changed_properties = _(changed_properties).union([k]);
							var dd = u.deferred();
							u.when(vs.map(function(v) {	return deserialize_value(v, this_);	})).then(function(values) {
								var new_vals = (cached_obj.get(k) || []).concat(values);
								cached_obj.set(k,new_vals);
								dd.resolve();
							}).fail(dd.reject);
							return dd.promise();
						});
                        var replaced_propval_dfs = _(obj.replaced).map(function(vs, k) {
                            debug("Processing replaced property");
                            changed_properties = _(changed_properties).union([k]);
                            var dd = u.deferred();
                            u.when(vs.map(function(v) { return deserialize_value(v, this_); })).then(function(values) {
                                var new_vals = values; // this is the difference from added - just replace (by DS)
                                cached_obj.set(k,new_vals);
                                dd.resolve();
                            }).fail(dd.reject);
                            return dd.promise();
                        });
                        u.when(added_propval_dfds.concat(deleted_propval_dfds).concat(replaced_propval_dfs)).then(function() {
							// u.debug("triggering changed properties ", changed_properties);
							changed_properties.map(function(k) {
								cached_obj.trigger('change:'+k, cached_obj, (cached_obj.get(k) || []).slice());
								u.debug("trigger! change:"+k);
							});
							cdfd.resolve(cached_obj);
						}).fail(cdfd.reject);
						return cdfd.promise();
					}
				});
				u.when(change_dfds).then(d.resolve).fail(d.reject);
				return d.promise();
			},
			_create_model_for_id: function(obj_id){
				var model = new Obj({"@id":obj_id}, {box:this});
				this._objcache().add(model);
				return model;
			},
			/// @arg {string|string[]} objid - id or ids of objects to retrieve
			/// retrieves all of the objects by their ids specified from the server into the cache if not loaded, otherwise just returns the cached models
			/// @then({Obj|Obj[]} Array of loaded objects)
			/// @fail({string} Error raised during process)
			get_obj:function(objid) {
				// get_obj always returns a promise
				// console.log(' get_obj() >> ', objid);

				u.assert(typeof objid === 'string' || typeof objid === 'number' || _.isArray(objid), "objid has to be a number or string or an array of such things");
				var multi = _.isArray(objid),
					ids = multi ? objid : [objid],
					d = u.deferred(),
					this_ = this;

				// if has model
				// to fix a deadlock condition -
				// if we fetch someone who loops back to us
				// then we will never resolve with this code:
				//
				// fetching_dfd.then(d.resolve).fail(d.reject);
				// return d.promise();
				// --
				// therefore a fix:

				var missing_models = {}, dmissing_by_id = {};
				var ds = ids.map(function(oid) {
					var cachemodel = this_._objcache().get(oid);
					if (cachemodel) { return u.dresolve(cachemodel);	}
					// otherwise we make a placeholder and loda it
					var model = this_._create_model_for_id(oid);

					missing_models[oid] = model;
					dmissing_by_id[oid] = u.deferred();
					this_._fetching_queue[oid] = d;
					return dmissing_by_id[oid];
				});
				var lacks = _(missing_models).keys();
				if (lacks.length > 0) {
					// console.log('calling with lacks ', lacks.length);
					u.dmap(u.chunked(lacks, 150), function(lids) {
						// console.log('lids length ', lids.length);
						this_._ajax('GET', this_.get_id(), {'id':lids}).then(function(response) {
							var resolved_ids = _(response.data).map(function(mraw,id) {
								if (id[0] === '@') { return; }
								var model = missing_models[id];
								u.assert(id, "Got an id undefined");
								u.assert(model, "Got a model we didnt ask for", id);
								model._set_fetched(true);
								// console.log('calling deserialise and set on ', mraw);
								model._deserialise_and_set(mraw).then(function() {
									dmissing_by_id[id].resolve(model);
									delete this_._fetching_queue[id];
								}).fail(function(e){
									dmissing_by_id[id].reject('Error loading ' + id + ' ' + e);
									delete this_._fetching_queue[id];
								});
								return id;
							}).filter(u.defined);

							// NOT ACCOUNTED FOR check >>
							// models not accounted for were blank.
							_(lids).difference(resolved_ids).map(function(id) {
								dmissing_by_id[id].resolve(missing_models[id]);
								delete this_._fetching_queue[id];
							});
						}).fail(function(error) {
							lids.map(function(id) {
								dmissing_by_id[id].reject(error);
								delete this_._fetching_queue[id];
							});
						});
						return u.when(lids.map(function(id) { return dmissing_by_id[id]; }));
					});
				} else {
					console.log('already have all the models, returning directly ');
				}
				return multi ? u.when(ds) : ds[0];
			},
			// ----------------------------------------------------
			_update_object_list:function(updated_obj_ids, added, deleted) {
				var current, olds = this._objlist().slice(), this_ = this, news, died;
				// u.debug('_update_object_list +', added ? added.length : ' ', '-', deleted ? deleted.length : ' ');
				// u.debug('_update_object_list +', added || ' ', deleted || ' ');
				if (updated_obj_ids === undefined ) {
					current = _(u.uniqstr(olds.concat(added))).difference(deleted); //_(olds).chain().union(added).difference(deleted).value();
					news = (added || []).slice(); died = (deleted || []).slice();
				} else {
					current = updated_obj_ids.slice();
					news = _(current).difference(olds);
					died = _(olds).difference(current);
				}
				// u.debug('old objlist had ', olds.length, ' new has ', current.length, 'news > ', news);
				this._set_objlist(current);
				news.map(function(aid) { this_.trigger('obj-add', aid);	});
				died.map(function(rid) {
					this_.trigger('obj-remove', rid);
					this_._objcache().remove(rid);
				});
			},
			_is_fetched: function() {	return this.id !== undefined;	},
			_fetch:function() {
				// all fetch really does is retrieve ids!
				// new client :: this now _only_ fetches object ids
				// return a list of models (each of type Object) to populate a GraphCollection
				var d = u.deferred(), fd = u.deferred(), this_ = this;
				if (this._is_fetched()) {
					// Nope - don't do anything -- we just wait for websockets to update us.
					fd.resolve();
				} else {
					// otherwise we aren't fetched, so we just do it
					var box = this.get_id();
					this._ajax("GET",[box,'get_object_ids'].join('/')).then(
						function(response){
							u.assert(response['@version'] !== undefined, 'no version provided');
							this_.id = this_.get_id(); // sets so that _is_fetched later returns true
							this_._set_version(response['@version']);
							this_._update_object_list(response.ids);
							fd.resolve(this_);
						}).fail(fd.reject);
				}
				fd.then(function() {
					this_.trigger('update-from-master', this_.get_version());
					d.resolve(this_);
				}).fail(d.reject);
				return d.promise();
			},
			// -----------------------------------------------
			_check_token_and_fetch : function() {
				var this_ = this;
				if (this.get('token') === undefined) {
					var d = u.deferred();
					this.get_token()
						.then(function() { this_._fetch().then(d.resolve).fail(d.reject);	})
						.fail(d.reject);
					return d.promise();
				}
				return this_._fetch();
			},
			_create_box:function() {
				var d = u.deferred();
				var this_ = this;
				this.store._ajax('POST', 'admin/create_box', { name: this.get_id() } )
					.then(function() {
						this_.fetch().then(function() { d.resolve(); }).fail(function(err) { d.reject(err); });
					}).fail(function(err) { d.reject(err); });
				return d.promise();
			},
			delete_box:function(boxid) {
				return this.store._ajax('POST','admin/delete_box', { name: boxid } );
			},
			// =============== :: UPDATE ::  ======================
			WHOLE_BOX: "__UPDATE__WHOLE__BOX__",
			_add_to_update_queue:function(ids_to_update) {
				var this_ = this, uq = this._update_queue;
				// returns the deferreds
				ids_to_update = ids_to_update === undefined ? [ this.WHOLE_BOX ] : ids_to_update;
				return ids_to_update.map(function(id) {
					uq[id] = uq[id] || u.deferred();
					return uq[id];
				});
			},
			_requeue_update:function() {
				var this_ = this;
				if (!this._update_timeout) {
					this._update_timeout = setTimeout(function() {
						delete this_._update_timeout;
						this_._flush_update_queue();
					}, 300);
				}
			},
			_flush_update_queue:function() {
				var this_ = this, uq = this._update_queue, ids_to_update = _(uq).keys();
				if (ids_to_update.length === 0) { return ; }
				if (this._updating || this._deleting) {
					return this._requeue_update();
				}

				this._update_queue = {};
				var update_arguments = ids_to_update.indexOf(this.WHOLE_BOX) >= 0 ? undefined : ids_to_update;
				this_._updating = true;

				this_._do_update(update_arguments).then(function() {
					delete this_._updating;
					// TODO: resolve all of our deferreds now and delete them
					ids_to_update.map(function(id) { uq[id].resolve();		});
				}).fail(function(err) {
					delete this_._updating;
					if (err.status === 409) {
						// add the defferds back in
						_(uq).map(function(d,id) {
							if (this_._update_queue[id]) {
								// someone's already added one back in! let's chain them
								u.debug('HEYYYYYYYYYYYYYYYYYYYYYY already added in - lets go');
								this_._update_queue[id].then(uq[id].resolve).fail(uq[id].reject);
							} else {
								u.debug('sneaking him back in - lets go');
								this_._update_queue[id] = uq[id];
							}
						});
						return this_._requeue_update();
					}
					// something bad happened, we'd better reject on those deferreds
					u.error('UPDATE error ', err);
					ids_to_update.map(function(id) { uq[id].reject(err);});
				});
			},
			_do_update:function(ids) {
				// this actua
				debug('box update >> ');
				var d = u.deferred(), version = this.get('version') || 0, this_ = this, oc = this._objcache(),
				objs = (ids === undefined ? oc.values() : ids.map(function(id) { return oc.get(id); })), // this._objcache().filter(function(x) { return ids === undefined || ids.indexOf(x.id) >= 0; }),
				obj_ids = (ids === undefined ? oc.keys() : ids.slice()), // objs.map(function(x) { return x.id; }),
				sobjs = objs.map(function(obj){ return serialize_obj(obj); });
				this._ajax("PUT",  this.get_id() + "/update", { version: escape(version), data : JSON.stringify(sobjs)  })
					.then(function(response) {
						this_._set_version(response.data["@version"]);
						this_._update_object_list(undefined, obj_ids, []); // update object list
						d.resolve(this_);
					}).fail(d.reject);
				return d.promise();
			},
			_update:function(original_ids) {
				// this is called by Backbone.save(),
				var dfds = this._add_to_update_queue(original_ids);
				this._flush_update_queue();
				return dfds;
			},
			// =============== :: DELETE ::  ======================
			_add_to_delete_queue:function(ids) {
				var this_ = this, dq = this._delete_queue;
				return ids.map(function(id) {
					dq[id] = dq[id] || u.deferred();
					return dq[id];
				});
			},
			_delete_models:function(ids) {
				var dfds =  this._add_to_delete_queue(ids);
				this._flush_delete_queue();
				return dfds;
			},
			_requeue_delete:function() {
				var this_ = this;
				if (!this._delete_timeout) {
					this._delete_timeout = setTimeout(function() {
						delete this_._delete_timeout;
						this_._flush_delete_queue();
					}, 300);
				}
			},
			_flush_delete_queue:function() {
				var this_ = this, dq = this._delete_queue, delete_ids = _(dq).keys();
				if (delete_ids.length === 0) { return ; }
				if (this._deleting || this._updating) { return this._requeue_delete();  }
				this_._deleting = true;
				this_._do_delete(delete_ids).then(function() {
					delete this_._deleting;
					delete_ids.map(function(id) {
						dq[id].resolve(); delete dq[id];
					});
				}).fail(function(err) {
					delete this_._deleting;
					if (err.status === 409) { this_._requeue_delete();	}
				});
			},
			_do_delete:function(m_ids) {
				var version = this.get('version') || 0, d = u.deferred(), this_ = this;
				this._ajax('DELETE', this.id+'/', { version:version, data: JSON.stringify(m_ids) })
					.then(function(response) {
						u.debug('DELETE response NEW version > ', response.data["@version"]);
						this_._set_version(response.data["@version"]);
						this_._update_object_list(undefined, [], m_ids); // update object list
						d.resolve(this_);
					}).fail(d.reject);
				return d.promise();
			},
			// =============== :: SYNC ::  ======================
			sync: function(method, box, options){
				switch(method)
				{
				case "create": return box._create_box();
				case "read": return box._check_token_and_fetch();
				case "update": return box._update()[0];  // save whole box?
				case "delete": return this.delete_box(this.get_id()); // hook up to destroy
				}
			},
			toString: function() { return 'box:' + this.get_id(); }
		});

		var BoxCollection = Backbone.Collection.extend({ model: Box });

		var Store =  Backbone.Model.extend({
			defaults: {
				server_host:DEFAULT_HOST,
				app:"--default-app-id--"
			},
			ajax_defaults : {
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
			is_same_domain:function() {
				return this.get('server_host').indexOf(document.location.host) >= 0 && (document.location.port === (this.get('server_port') || ''));
			},
			boxes:function() { return this.attributes.boxes;	},
			get_box: function(boxid) {
				var b = this.boxes().get(boxid) || this._create(boxid);
				if (!b._get_cached_token()) {
					return b.get_token().pipe(function() {
						return b.fetch();
					});
				}
				return u.dresolve(b);
			},


			/// @arg {string|number} boxid - the id for the box
			///
			/// @then({Box} the box)
			/// @fail({{ code: 409 }} response) - box already exists
			/// @fail({{ code: -1, error: error_obj }} response) - other error
			///
			/// Attempts to create a box with the given ID
			create_box: function (boxid) {
				u.debug('create box ', boxid);
				if (this.boxes().get(boxid)) {
					return u.dreject({ code: 409, message: 'Box already exists: ' + boxid });
				}
				var c = this._create(boxid), this_ = this;
				u.debug('creating ', boxid);
				return c.save().pipe(function() { return this_.get_box(boxid); });
			},
			check_login:function() {
				// checks whether you can connect to the server and who is logged in.
				// returns a deferred that gets passed an argument
				// { code:200 (server is okay),  is_authenticated:true/false,  user:<username>  }
				return this._ajax('GET', 'auth/whoami');
			},
			// todo: change to _
			get_info:function() { return this._ajax('GET', 'admin/info'); },
			login : function(username,password) {
				var d = u.deferred();
				this.set({username:username,password:password});
				var this_ = this;
				this._ajax('POST', 'auth/login', { username: username, password: password })
					.then(function(l) { this_.trigger('login', username); d.resolve(l); })
					.fail(function(l) { d.reject(l); });
				return d.promise();
			},
			reconnect:function() {
				return this.login(this.get('username'),this.get('password'));
			},
			logout : function() {
				console.log('store --- logout');
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
			get_box_list:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_boxes')
					.success(function(data) {d.resolve(data.list);})
					.fail(function(err) { d.reject(err); });
				return d.promise();
			},
			get_user_list:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_users')
					.success(function(data) {d.resolve(data.users);})
					.fail(function(err) { d.reject(err); });
				return d.promise();
			},
			get_apps_list:function() {
				var d = u.deferred();
				this._ajax('GET','admin/list_apps')
					.success(function(data) { d.resolve(data.apps); })
					.fail(function(err) { d.reject(err); });
				return d.promise();
			},
			_fetch:function() {
				throw new Error('dont fetch a store - any more!');
				//
				// fetches list of boxes
				/* - do not do this
				var this_ = this, d = u.deferred();
				this._ajax('GET','admin/list_boxes')
					.success(function(data) {
						u.when(data.list.map(function(boxid) { return this_.get_box(boxid); })).then(function(boxes) {
							// console.log("boxes !! ", boxes);
							this_.boxes().reset(boxes);
							d.resolve(boxes);
						});
					}).error(function(e) { d.reject(e); });
				return d.promise();
				*/
			},
			_ajax:function(method, path, data) {
				// now uses relative url scheme '//blah:port/path';
				var url = ['/', this.get('server_host'), path].join('/');
				var default_data = { app: this.get('app') };
				var options = _(_(this.ajax_defaults).clone()).extend(
					{ url: url, method : method, crossDomain: !this.is_same_domain(), data: _(default_data).extend(data) }
				);
				return $.ajax( options ); // returns a deferred
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
			safe_apply:utils.safe_apply,
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
		var deep_clone_obj = function(o) {
			return utils.dict(_(o).map(function(v,k) { return [k, v.concat()]; }));
		};
		var scope_bind = function($scope, name, model) {
			utils.assert(model instanceof Backbone.Model, "tried to bind something that was not a model");
			window._m = model;
			var clone = deep_clone_obj(_(model.attributes));
			utils.safe_apply($scope, function() { $scope[name] = clone;	});
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
				utils.safe_apply($scope, function() {
					findchanges(clone, model.attributes, function(k,v) { clone[k] = v;	});
				});
			},$scope);
		};
		return {
			scope_bind: scope_bind,
			scope_unbind:function($scope,name) {
				deregfns.map(function(tuple) {
					var scope = tuple[0],name = tuple[1],model = tuple[2],dereg = tuple[3];
					model.off('change', null, scope);
					dereg();
				});
			}
		};
	});
