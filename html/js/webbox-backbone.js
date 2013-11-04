/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true, todo:true */
/*

  WebBox.js is the JS Client SDK for WebBox WebBox
  which builds upon Backbone's Model architecture.

  CURRENT TODOs:
  	- update only supports updating the entire box
    - Box.fetch() retrieves _entire box contents_
	  ... which is a really bad idea.

  @prerequisites:
	jquery 1.8.0 or higher
	backbone.js 0.9.2 or higher
	underscore.js 1.4.2 or higher

    Copyright (C) 2011-2013 University of Southampton
    Copyright (C) 2011-2013 Daniel Alexander Smith
    Copyright (C) 2011-2013 Max Van Kleek
    Copyright (C) 2011-2013 Nigel R. Shadbolt

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License, version 3,
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

(function(){
	// intentional fall-through to window if running in a browser
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
	var DEFAULT_HOST = document.location.host; // which may contain the port

	var WS_MESSAGES_SEND = {
		auth: function(token) { return JSON.stringify({action:'auth', token:token}); },
		diff: function(token) { return JSON.stringify({action:'diff', operation:"start"}); }
	};

	var serializeObj = function(obj) {
		var uri = obj.id;
		var outObj = {};
		$.each(obj.attributes, function(pred, vals){
			if (pred[0] === "_" || pred[0] === "@"){
				// don't expand @id etc.
				return;
			}
			var objVals = [];
			if (!(vals instanceof Array)){
				vals = [vals];
			}
			$.each(vals, function(){
				var val = this;
				if (val instanceof WebBox.File) {
					objVals.push({"@value": val.id, "@type":"webbox-file", "@language":val.get('content-type')});
				} else if (val instanceof WebBox.Obj) {
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

	var literalDeserializers = {
		'': function(o) { return o['@value']; },
		"http://www.w3.org/2001/XMLSchema#integer": function(o) { return parseInt(o['@value'], 10); },
		"http://www.w3.org/2001/XMLSchema#float": function(o) { return parseFloat(o['@value'], 10); },
		"http://www.w3.org/2001/XMLSchema#double": function(o) { return parseFloat(o['@value'], 10); },
		"http://www.w3.org/2001/XMLSchema#boolean": function(o) { return o['@value'].toLowerCase() === 'true'; },
		"http://www.w3.org/2001/XMLSchema#dateTime": function(o) { return new Date(Date.parse(o['@value'])); },
		"webbox-file": function(o,box) {
			var f = box.getOrCreateFile(o['@value']);
			f.set("content-type", o['@language']);
			return f;
		}
	};
	var deserializeLiteral = function(obj, box) {
		return obj['@value'] !== undefined ? literalDeserializers[ obj['@type'] || '' ](obj, box) : obj;
	};

	var deserializeValue = function(sVal, box) {
		var vd = u.deferred();
		// it's an object, so return that
		if (sVal.hasOwnProperty("@id")) {
			// object
			box.getObj(sVal["@id"]).then(vd.resolve).fail(vd.reject);
		}
		else if (sVal.hasOwnProperty("@value")) {
			// literal
			vd.resolve(deserializeLiteral(sVal, box));
		}
		else {
			// don't know what it is!
			vd.reject('cannot unpack value ', sVal);
		}
		return vd.promise();
	};

	var File = WebBox.File = Backbone.Model.extend({
		idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
		initialize:function(attrs, options) {
			u.debug('options >> ', attrs, options );
			this.box = options.box;
		},
		getId:function() { return this.id;	},
		getUrl:function() {
			var params = {
				id:this.getId(),
				app:this.box.store.get('app'),
				token:this.box.get('token'),
				box:this.box.getId()
			}, url = ['/', this.box.store.get('serverHost'), this.box.id, 'files'].join('/') + '?' + $.param(params);
			// u.debug("IMAGE URL IS ", url, params);
			return url;
		}
	});


	// MAP OF THIS MODUULE :::::::::::::: -----
	//
	// An Obj is a single instance, thing in WebBox.
	//
	// A Box is a model that has an attribute called 'Objs'.
	// ...  which is a Backbone.Collection of Graph objects.
	//
	// A _Store_ represents a single WebBox server, which has an
	//	 attribute called 'boxes' -
	// ... which is a collection of Box objects
	var Obj = WebBox.Obj = Backbone.Model.extend({
		idAttribute: "@id", // the URI attribute is '@id' in JSON-LD
		initialize:function(attrs, options) {
			this.box = options.box;
		},
		_isFetched: function() { return this._fetched || false; },
		_setFetched : function() { this._fetched = true; },
		getId:function() { return this.id;	},
		_valueToArray:function(k,v) {
			if (k === '@id') { return v; }
			if (!_(v).isUndefined() && !_(v).isArray()) {
				return [v];
			}
			return v;
		},
		_allValuesToArrays:function(o) {
			if (!_(o).isObject()) {	console.error(' not an object', o); return o; }
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
		_deserialiseAndSet:function(sObj, silent) {
			// returns a promise
			var this_ = this;
			var dfds = _(sObj).map(function(vals, key) {
				var kd = u.deferred();
				if (key.indexOf('@') === 0) { return; }
				var valDfds = vals.map(function(val) {
					var vd = u.deferred();
					// it's an object, so return that
					if (val.hasOwnProperty("@id")) {
						// object
						this_.box.getObj(val["@id"]).then(vd.resolve).fail(vd.reject);
					}
					else if (val.hasOwnProperty("@value")) {
						// literal
						vd.resolve(deserializeLiteral(val, this_.box));
					}
					else {
						// don't know what it is!
						vd.reject('cannot unpack value ', val);
					}
					return vd.promise();
				});
				u.when(valDfds).then(function(objVals) {
					// only update keys that have changed
					var prevVals = this_.get(key);
					if ( prevVals === undefined || objVals.length !== prevVals.length ||
						 _(objVals).difference(prevVals).length > 0 ||
						 _(prevVals).difference(objVals).length > 0) {
						this_.set(key, objVals, { silent : silent });
					}
					kd.resolve();
				}).fail(kd.reject);
				return kd.promise();
			}).filter(u.defined);
			return u.when(dfds);
		},
		_fetch:function() {
			var this_ = this, fd = u.deferred(), box = this.box.getId();
			this.box._ajax('GET', box, {'id':this.id}).then(function(response) {
				this_._setFetched(true);
				var objdata = response.data;
				if (objdata['@version'] === undefined) {
					// according to the server, we're dead.
					console.log('zombie detected ', this_.id);
					this_.cid = this_.id;
					this_.unset({});
					delete this_.id;
					fd.resolve();
					return;
				}
				// we are at current known version as far as we know
				var objSaveDfds = _(objdata).map(function(obj,uri) {
						// top level keys - corresponding to box level properties
						if (uri[0] === "@") { return; } // ignore "@id", "@version" etc
						// not one of those, so must be a
						// < uri > : { prop1 .. prop2 ... }
						u.assert(uri === this_.id, 'can only deserialise this object');
						return this_._deserialiseAndSet(obj);
					});
				u.when(objSaveDfds).then(function(){ fd.resolve(this_); }).fail(fd.reject);
			});
			return fd.promise();
		},
		sync: function(method, model, options){
			switch(method){
			case "create": return u.assert(false, "create is never used for Objs");
			case "read"  : return model._fetch();
			case "update":
				return  model.box.update([model.id])[0];
			case "delete":
				return this.box._deleteModels([this.id])[0];
			}
		}
	});


	// Box =================================================
	// WebBox.GraphCollection is the list of WebBox.Objs in a WebBox.Graph
	var ObjCollection = Backbone.Collection.extend({ model: Obj }),
		FileCollection = Backbone.Collection.extend({ model: File });

	// new client: fetch is always lazy, only gets ids, and
	// lazily get objects as you go
	var Box = WebBox.Box = Backbone.Model.extend({
		idAttribute:"@id",
		defaultOptions: { useWebsockets:true, wsAutoReconnect:false	},
		initialize:function(attributes, options) {
			var this_ = this;
			u.assert(options.store, "no store provided");
			this.store = options.store;
			this.set({objcache: new ObjCollection(), objlist: [], files : new FileCollection() });
			this.options = _(this.defaultOptions).chain().clone().extend(options || {}).value();
			this.setUpWebsocket();
			this._updateQueue = {};
			this._deleteQueue = {};
			this._fetchingQueue = {};
			this.on('update-from-master', function() {
				// u.log("UPDATE FROM MASTER >> flushing ");
				this_._flushUpdateQueue();
				this_._flushDeleteQueue();
			});
		},
		getOrCreateFile:function(fid) {
			var files = this.get('files');
			if (files.get(fid) === undefined) {
				files.add(new File({"@id": fid}, { box: this }));
			}
			return files.get(fid);
		},
		setUpWebsocket:function() {
			var this_ = this, serverHost = this.store.get('serverHost');
			if (! this.getUseWebsockets() ) { return; }
			this.on('new-token', function(token) {
				var ws = this_._ws;
				if (ws) {
					try {
						ws.close();
						delete this_._ws;
					} catch(e) { u.error(); }
				}
				var protocol = (document.location.protocol === 'https:') ? 'wss:/' : 'ws:/';
				var wsUrl = [protocol,serverHost,'ws'].join('/');
				ws = new WebSocket(wsUrl);
				ws.onmessage = function(evt) {
					u.debug('websocket :: incoming a message ', evt.data.toString().substring(0,190));
					var pdata = JSON.parse(evt.data);
					if (pdata.action === 'diff') {
						this_._diffUpdate(pdata.data)
							.then(function() {
								this_.trigger('update-from-master', this_._getVersion());
							}).fail(function(err) {
								u.error(err); /*  u.log('done diffing '); */
							});
					}
				};
				ws.onopen = function() {
					var data = WS_MESSAGES_SEND.auth(this_.get('token'));
					ws.send(data);
					data = WS_MESSAGES_SEND.diff();
					ws.send(data);
					this_._ws = ws;
					this_.trigger('ws-connect');
				};
				ws.onclose = function(evt) {
					// what do we do now?!
					u.error('websocket closed -- ');
					// TODO
					var interval;
					interval = setInterval(function() {
						this_.store.reconnect().then(function() {
							this_.getToken().then(function() {
								clearInterval(interval);
							});
						});
					},1000);
				};
			});
		},
		getUseWebsockets:function() { return this.options.useWebsockets; },
		getCacheSize:function(i) { return this._objcache().length; },
		getObjIds:function() { return this._objlist().slice(); },
		_objcache:function() { return this.attributes.objcache; },
		_objlist:function() { return this.attributes.objlist !== undefined ? this.attributes.objlist : []; },
		_setObjlist:function(ol) { return this.set({objlist:ol.slice()}); },
		_setToken:function(token) { this.set("token", token);	},
		_setVersion:function(v) { this.set("version", v);	},
		_getVersion:function(v) { return this.get("version"); },
		getToken:function() {
			console.log('>> getToken ', ' id: ',this.id, ' cid: ',this.cid);
			var this_ = this, d = u.deferred();
			this._ajax('POST', 'auth/getToken', { app: this.store.get('app') })
				.then(function(data) {
					this_._setToken( data.token );
					this_.trigger('new-token', data.token);
					d.resolve(this_);
				}).fail(d.reject);
			return d.promise();
		},
		getId:function() { return this.id || this.cid;	},
		_ajax:function(method, path, data) {
			data = _(_(data||{}).clone()).extend({box: this.id || this.cid, token:this.get('token')});
			return this.store._ajax(method, path, data);
		},
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
		_doPutFile:function(id,file,contenttype) {
			// now uses relative url scheme '//blah:port/path';
			// all files must be PUT into boxname/files
			// here the parameters are get encoded
			// // 'http://' + this.store.get('serverHost') + "/" +  boxid + "/" + 'files',
			var boxid = this.id || this.cid,
				baseUrl = ['/', this.store.get('serverHost'), boxid, 'files'].join('/'),
				options = { app: this.store.get('app'), id: id, token:this.get('token'),  box: boxid, version: this._getVersion() },
			    optionParams = $.param(options),
				url = baseUrl+"?"+optionParams,
				d = u.deferred();
			console.log("PUTTING FILE ", url);
			var ajaxArgs  = _(_(this.store.ajaxDefaults).clone()).extend(
				{ url: url, method : 'PUT', crossDomain:false, data:file, contentType: contenttype, processData:false }
			);
			return $.ajax( ajaxArgs );
		},
		query: function(q){
			// @TODO ::::::::::::::::::::::::::
			u.NotImplementedYet();
			// var d = u.deferred();
			// this._ajax(this, "/query", "GET", {"q": JSON.stringify(q)})
			// 	.then(function(data){
			// 		console.debug("query results:",data);
			// 	}).fail(function(data) {
			// 		console.debug("fail query");
			// 	});
			// return d.promise();
		},
		_diffUpdate:function(response) {
			var d = u.deferred(), this_ = this, latestVersion = response['@toVersion'],
			addedIds  = _(response.data.added).keys(),
			changedIds = _(response.data.changed).keys(),
			deletedIds = _(response.data.deleted).keys(),
			changedObjs = response.data.changed;

			u.assert(latestVersion !== undefined, 'latest version not provided');
			u.assert(addedIds !== undefined, 'addedIds not provided');
			u.assert(changedIds !== undefined, 'changed not provided');
			u.assert(deletedIds !== undefined, 'deleted _ids not provided');

			if (latestVersion <= this_._getVersion()) {
				u.debug('asked to diff update, but already up to date, so just relax!', latestVersion, this_._getVersion());
				return d.resolve();
			}
			u.debug('setting latest version >> ', latestVersion, addedIds, changedIds, deletedIds);
			this_._setVersion(latestVersion);
			this_._updateObjectList(undefined, addedIds, deletedIds);
			var changeDfds = _(changedObjs).map(function(obj, uri) {
				u.debug(' checking to see if in --- ', uri, this_._objcache().get(uri));
				u.debug('obj >> ', obj);
				var cachedObj = this_._objcache().get(uri), cdfd = u.deferred();
				if (cachedObj) {
					// { prop : [ {sval1 - @type:""}, {sval2 - @type} ... ]
					var changedProperties = [];
					console.log("obj deleted ", obj.deleted);
					var deletedPropvalDfds = _(obj.deleted).map(function(vs, k) {
						changedProperties = _(changedProperties).union([k]);
						var dd = u.deferred();
						u.when(vs.map(function(v) {	return deserializeValue(v, this_);	})).then(function(values) {
							var newVals = _(cachedObj.get(k) || []).difference(values);
							// console.log("DESERIALISED deleted values ", values, " - ", " newVals ", newVals);
							// window._values = values; window._newvals = newVals;
							cachedObj.set(k,newVals);
							// semantics - if a property has no value then we delete it
							if (newVals.length === 0) { cachedObj.unset(k); }
							dd.resolve();
						}).fail(dd.reject);
						return dd.promise();
					});
					var addedPropvalDfds = _(obj.added).map(function(vs, k) {
						changedProperties = _(changedProperties).union([k]);
						var dd = u.deferred();
						u.when(vs.map(function(v) {	return deserializeValue(v, this_);	})).then(function(values) {
							var newVals = (cachedObj.get(k) || []).concat(values);
							cachedObj.set(k,newVals);
							dd.resolve();
						}).fail(dd.reject);
						return dd.promise();
					});
					u.when(addedPropvalDfds.concat(deletedPropvalDfds)).then(function() {
						// u.debug("triggering changed properties ", changedProperties);
						changedProperties.map(function(k) {
							cachedObj.trigger('change:'+k, ycachedObj, (ycachedObj.get(k) || []).slice());
							u.debug("trigger! change:"+k);
						});
						cdfd.resolve(cachedObj);
					}).fail(cdfd.reject);
					return cdfd.promise();
				}
			});
			u.when(changeDfds).then(d.resolve).fail(d.reject);
			return d.promise();
		},
		_createModelForId: function(objId){
			var model = new Obj({"@id":objId}, {box:this});
			this._objcache().add(model);
			return model;
		},
		getObj:function(objid) {
			// getObj always returns a promise
			u.assert(typeof objid === 'string' || typeof objid === 'number', "objid has to be a number or string");
			var d = u.deferred(),
				cachemodel = this._objcache().get(objid),
				fetchingDfd = this._fetchingQueue[objid],
				hasmodel = cachemodel && fetchingDfd === undefined,
				this_ = this;

			if (hasmodel) {	d.resolve(cachemodel); return d.promise(); }

			// check to see if already fetching, then we can tag along
			if (fetchingDfd) {
				// to fix a deadlock condition -
				// if we fetch someone who loops back to us
				// then we will never resolve with this code:
				//
				// fetchingDfd.then(d.resolve).fail(d.reject);
				// return d.promise();
				// --
				// therefore a fix:
				d.resolve(cachemodel);
				return d.promise();
			}

			// if not already fetching then we have to fetch
			this._fetchingQueue[objid] = d;
			var model = this_._createModelForId(objid);
			// if the serve knows about it, then we fetch its definition
			if (this._objlist().indexOf(objid) >= 0) {
				model.fetch().then(function() {
					d.resolve(model);
					delete this_._fetchingQueue[objid];
				}).fail(d.reject);
			} else {
				// otherwise it must be new!
				model.isNew = true;
				d.resolve(model);
			}
			return d.promise();
		},
		// ----------------------------------------------------
		_updateObjectList:function(updatedObjIds, added, deleted) {
			var current, olds = this._objlist().slice(), this_ = this, news, died;
			// u.debug('_updateObjectList +', added ? added.length : ' ', '-', deleted ? deleted.length : ' ');
			// u.debug('_updateObjectList +', added || ' ', deleted || ' ');
			if (updatedObjIds === undefined ) {
				current = _(olds).chain().union(added).difference(deleted).value();
				news = (added || []).slice(); died = (deleted || []).slice();
			} else {
				current = updatedObjIds.slice();
				news = _(current).difference(olds);
				died = _(olds).difference(current);
			}
			u.debug('old objlist had ', olds.length, ' new has ', current.length, 'news > ', news);
			this._setObjlist(current);
			news.map(function(aid) {
				this_.trigger('obj-add', aid);
			});
			died.map(function(rid) {
				// u.debug('>> webbox-backbone :: obj-remove ', rid);
				this_.trigger('obj-remove', rid);
				this_._objcache().remove(rid);
			});
		},
		_isFetched: function() {
			return this.id !== undefined;
		},
		_fetch:function() {
			// all fetch really does is retrieve ids!
			// new client :: this now _only_ fetches object ids
			// return a list of models (each of type WebBox.Object) to populate a GraphCollection
			var d = u.deferred(), fd = u.deferred(), this_ = this;
			if (this._isFetched()) {
				// Nope - don't do anything -- we just wait for websockets to update us.
				fd.resolve();
			} else {
				// otherwise we aren't fetched, so we just do it
				var box = this.getId();
				this._ajax("GET",[box,'getObjectIds'].join('/')).then(
					function(response){
						u.assert(response['@version'] !== undefined, 'no version provided');
						this_.id = this_.getId(); // sets so that _isFetched later returns true
						this_._setVersion(response['@version']);
						this_._updateObjectList(response.ids);
						fd.resolve(this_);
					}).fail(fd.reject);
			}
			fd.then(function() {
				this_.trigger('update-from-master', this_._getVersion());
				d.resolve(this_);
			}).fail(d.reject);
			return d.promise();
		},
		// -----------------------------------------------
		_checkTokenAndFetch : function() {
			var this_ = this;
			if (this.get('token') === undefined) {
				var d = u.deferred();
				this.getToken()
					.then(function() { this_._fetch().then(d.resolve).fail(d.reject);	})
					.fail(d.reject);
				return d.promise();
			}
			return this_._fetch();
		},
		_createBox:function() {
			var d = u.deferred();
			var this_ = this;
			this.store._ajax('POST', 'admin/createBox', { name: this.getId() } )
				.then(function() {
					this_.fetch().then(function() { d.resolve(); }).fail(function(err) { d.reject(err); });
				}).fail(function(err) { d.reject(err); });
			return d.promise();
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
			if (!this._updateTimeout) {
				this._updateTimeout = setTimeout(function() {
					delete this_._updateTimeout;
					this_._flushUpdateQueue();
				}, 300);
			}
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
				idsToUpdate.map(function(id) { uq[id].resolve();		});
			}).fail(function(err) {
				delete this_._updating;
				if (err.status === 409) {
					// add the defferds back in
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
			var d = u.deferred(), version = this.get('version') || 0, this_ = this,
			    objs = this._objcache().filter(function(x) { return ids === undefined || ids.indexOf(x.id) >= 0; }),
			    objIds = objs.map(function(x) { return x.id; }),
				sobjs = objs.map(function(obj){ return serializeObj(obj); });
			this._ajax("PUT",  this.id + "/update", { version: escape(version), data : JSON.stringify(sobjs)  })
				.then(function(response) {
					this_._setVersion(response.data["@version"]);
					this_._updateObjectList(undefined, objIds, []); // update object list
					d.resolve(this_);
				}).fail(d.reject);
			return d.promise();
		},
		update:function(originalIds) {
			// this is called by Backbone.save(),
			var dfds = this._addToUpdateQueue(originalIds);
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
			if (!this._deleteTimeout) {
				this._deleteTimeout = setTimeout(function() {
					delete this_._deleteTimeout;
					this_._flushDeleteQueue();
				}, 300);
			}
		},
		_flushDeleteQueue:function() {
			var this_ = this, dq = this._deleteQueue, deleteIds = _(dq).keys();
			if (deleteIds.length === 0) { return ; }
			if (this._deleting || this._updating) { return this._requeueDelete();  }
			this_._deleting = true;
			this_._doDelete(deleteIds).then(function() {
				delete this_._deleting;
				deleteIds.map(function(id) {
					dq[id].resolve(); delete dq[id];
				});
			}).fail(function(err) {
				delete this_._deleting;
				if (err.status === 409) { this_._requeueDelete();	}
			});
		},
		_doDelete:function(mIds) {
			var version = this.get('version') || 0, d = u.deferred(), this_ = this;
			this._ajax('DELETE', this.id+'/', { version:version, data: JSON.stringify(mIds) })
				.then(function(response) {
					u.debug('DELETE response NEW version > ', response.data["@version"]);
					this_._setVersion(response.data["@version"]);
					this_._updateObjectList(undefined, [], mIds); // update object list
					d.resolve(this_);
				}).fail(d.reject);
			return d.promise();
		},
		// =============== :: SYNC ::  ======================
		sync: function(method, box, options){
			switch(method)
			{
			case "create": return box._createBox();
			case "read": return box._checkTokenAndFetch();
			case "update": return box.update()[0];  // save whole box?
			case "delete": return u.warn('box.delete() : not implemented yet');
			}
		},
		toString: function() { return 'box:' + this.getId(); }
	});

	var BoxCollection = Backbone.Collection.extend({ model: Box });

	var Store = WebBox.Store = Backbone.Model.extend({
		defaults: {
			serverHost:DEFAULT_HOST,
			app:"--default-app-id--",
			toolbar:true
		},
		ajaxDefaults : {
			jsonp: false, contentType: "application/json",
			xhrFields: { withCredentials: true }
		},
		initialize: function(attributes, options){
			this.set({boxes : new BoxCollection([], {store: this})});
			// load and launch the toolbar
			if (this.get('toolbar')) { this._loadToolbar(); }
		},
		isSameDomain:function() {
			// FIXME: indexOf is insecure? http://evilwebsite.com/localhost/blah would pass
			return this.get('serverHost').indexOf(document.location.host) >= 0 && (document.location.port === (this.get('serverPort') || ''));
		},
		_loadToolbar:function() {
			this.toolbar = WebBox.Toolbar;
			this.toolbar.setStore(this);
			// this.toolbar.load(el[0], this).then(function() {u.debug('done loading toolbar, apparently');});
		},
		boxes:function() {	return this.attributes.boxes;	},
		getBox: function(boxid) {	return this.boxes().get(boxid);	},
		getOrCreateBox:function(boxid) { return this.boxes().get(boxid) || this._create(boxid);	},
		checkLogin:function() { return this._ajax('GET', 'auth/whoami'); },
		getInfo:function() { return this._ajax('GET', 'admin/info'); },
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
		_fetch:function() {
			// fetches list of boxes
			var this_ = this, d = u.deferred();
			this._ajax('GET','admin/listBoxes')
				.success(function(data) {
					var boxes =	data.list.map(function(boxid) { return this_.getOrCreateBox(boxid); });
					this_.boxes().reset(boxes);
					d.resolve(boxes);
				}).error(function(e) { d.reject(e); });
			return d.promise();
		},
		_ajax:function(method, path, data) {
			// now uses relative url scheme '//blah:port/path';
			var url = ['/', this.get('serverHost'), path].join('/');
			var defaultData = { app: this.get('app') };
			var options = _(_(this.ajaxDefaults).clone()).extend(
				{ url: url, method : method, crossDomain: !this.isSameDomain(), data: _(defaultData).extend(data) }
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

	WebBox.loaderDependencies = {
		utils : { path: '/js/utils.js', dfd : new $.Deferred()  },
		toolbar : { path: '/components/toolbar/toolbar.js', dfd : new $.Deferred()  }
	};

	WebBox.load = function(options) {
		var baseUrl = options && options.baseUrl;
		if (!baseUrl) { baseUrl = ['/', document.location.host].join('/'); }
		var loadfns = _(WebBox.loaderDependencies).map(function(dependency,name) {
			return function() {
				$.getScript(baseUrl + dependency.path);
				return dependency.dfd;
			};
		});
		var recursiveLoader = function(rest) {
			if (rest.length === 0) { return (new $.Deferred()).resolve().promise(); }
			var now = rest[0], dp = new $.Deferred();
			now().then(function() {
				recursiveLoader(rest.slice(1)).then(dp.resolve).fail(dp.reject);
			}).fail(dp.reject);
			return dp.promise();
		};
		var _loadD = new $.Deferred();
		recursiveLoader(loadfns).then(function() {
			u = WebBox.utils;
			_loadD.resolve(root);
		}).fail(function(err) { console.error(err); _loadD.reject(root); });
		return _loadD.promise();
	};
}).call(this);


