/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */

angular.module('indx')
	.factory('indxws', function(utils) {
		var u = utils;
		var WS_MESSAGES_SEND = {
			auth: function(requestid, token) { 
				return JSON.stringify({requestid:requestid,action:'auth',token:token}); 
			},
			diff: function(requestid, token, diffid) { 
				return JSON.stringify({requestid:requestid,action:'diff',operation:"start",token:token,diffid:diffid}); 
			},
			http: function(requestid, method, path, data) { 
				var toArrayVals = function(obj) {
					var out = {};
					_(obj).map(function(v,k) {
						if (v !== undefined) {
							out[k] = _.isArray(v) ? v : [v];
						}
					});
					return out;
				};
				data = toArrayVals(data);
				return JSON.stringify({
					requestid:requestid,
					action:'http',
					request:{
						path:"/"+path,
						method:method,
						params:{
							headers:{"Accept": "*/*"},
							args:method == 'GET' ? data : {},
						},
						content:method !== 'GET' ? data : undefined
					}
				});
			},
			echo:function(requestid, payload) {
				return JSON.stringify({
					requestid:requestid,
					action:'echo',
					payload:payload
				});
			}
		};

		var withoutProtocol=function(url) {
			if (url.indexOf('//') >= 0) {
				return url.slice(url.indexOf('//')+2);
			}
			return url;
		};
		var protocolOf = function(url) {
			if (url.indexOf('//') >= 0) {
				return url.slice(0,url.indexOf('//'));
			}
			// fall through
		};
		var IndxWebSocketHandler = Backbone.Model.extend({
			initialize:function(opts) {
				var this_ = this, 
					store = opts.store, 
					box = opts.box,
					server_host = store.get('server_host'),
					protocol = (document.location.protocol === 'https:' || protocolOf(server_host) === 'https:') ? 'wss:/' : 'ws:/',
					wprot = withoutProtocol(server_host),
					wsURL = [protocol,withoutProtocol(server_host),'ws'].join('/'),
					ws = new WebSocket(wsURL);

				this.box = box; this.store = store;
				this._ws = ws;
				this.requests = {}; // by requestid
				this.diffs = {}; // by diffid
				this.connected = u.deferred();
				this.opend = u.deferred();
				this.authed = u.deferred();
				this.readyd = u.deferred();
				this.diffid = u.guid();
				this._setup();
				this.opend.then(function() { 
					this_._ws_auth()
						.then(this_.authed.resolve)
						.fail(function() { 
							console.info("failed to auth with current token so calling getToken()");
							box.getToken().then(function(token) {
								console.log('successful getting token ', box, token);
								this_._ws_auth().then(this_.authed.resolve).fail(function() { 
									console.log('ailed to auth with newly obtained token ', box, token);
									this_.authed.reject(); 
								});
							}).fail(function(err) { 
								console.error('error getting new token', err);
								this_.authed.reject();
							});
						});
				}).fail(this_.readyd.reject);
				this.authed.then(function() {
					console.log('authed, now asking for diff ');
					this_._ws_diff(this_.diffid).then(function() { 
						box.trigger('ws-connect');
						this_.readyd.resolve(); // this should be conn
					}).fail(this_.readyd.reject);
				}).fail(this_.readyd.reject);
			},
			getReadyD:function() { return this.readyd; },
			handleMessage:function(evt) { 
				var this_ = this, box = this.box;
				box.trigger('message', evt);
				var pdata = JSON.parse(evt.data);
				if (pdata.action === 'diff' && pdata.diffid) {
					if (this_.diffs[pdata.diffid]) { 
						this_.diffs[pdata.diffid](pdata.data);
					} else {
						console.error('Got a diffid i didnt recognise ', pdata.diffid);
					}
				} else if (pdata.requestid !== undefined) { 
					// something with a requestid
					if (this_.requests[pdata.requestid] !== undefined) {
						var request = this_.requests[pdata.requestid];
						if (pdata.success === false || pdata.response && pdata.response.code && parseInt(pdata.response.code) >= 400) { 
							console.error('error -- ', pdata, " - request was ", request.frame, pdata.response && pdata.response.code, 'failing');
							// error :(
							request.responsed.reject(pdata.response);
						} else {
							// success! :)
							request.responsed.resolve(pdata.response || pdata); // && pdata.response.data
						}
						delete this_.requests[pdata.requestid];
					} else {
						console.error('had no request ', pdata.requestid);
					}
				}  else  if (pdata.error == "500 Internal Server Error" && pdata.success === false) {
					console.error('got a 500 websocket kiss of death, disconnecting.');								
					box._flush_tokens();
					box.disconnect();
				} else if (pdata.respond_to === 'connect' && pdata.success === true) {
					// connect 
					this_.connected.resolve();
				} else {
					// unhandled here, pass it on.
					console.log('ws :: unhanded message, passing on to the box ', pdata);
					box.trigger('websocket-message', pdata);					
				}
			},
			_setup: function() {
				var this_ = this, ws = this._ws, box = this.box;
				ws.onmessage = function(evt) { this_.handleMessage(evt); };
				ws.onopen = function() { this_.opend.resolve(); };
				ws.onclose = function(evt) {
					// what do we do now?!
					console.error("!!!!!!!!!!!!!!!! websocket closed -- lost connection to server");
					box.trigger('ws-disconnect');
					box._disconnected();
				};
			},
			_genid: function() { return u.guid(16); },
			isConnected:function() { 
				return this.readyd.state() == 'resolved' && this._ws && this._ws.readyState === 1; 
			},
			_fail_requests:function(status, message) {
				// todo: might we want to filter these only for http?
				var this_ = this, deadkeys = _(this.requests).map(function(val,key) {
					val.responsed.reject({status:status, message:message});
					return key;
				});
				deadkeys.map(function(k) { delete this_.requests[k]; });
			},
			addRequest:function(rid, frame) { 
				var this_ = this, req = {
					rid:rid,
					frame: frame,
					responsed:u.deferred()
				};
				this.requests[rid] = req;
				this.connected.then(function() { this_._ws.send(req.frame); });
				return req.responsed.promise();
			},
			addHttpRequest:function(method, path, data) { 
				var rid = this._genid(), d = u.deferred(), this_ = this;
				this.authed.then(function() {
				   this_.addRequest(rid, WS_MESSAGES_SEND.http(rid, method, path, data)).then(d.resolve).fail(d.reject);
				});
				return d.promise();
			},
			_ws_auth : function() {
				var token = this.box._getCachedToken() || this.box._getStoredToken(), 
					rid = this._genid(), this_ = this, d = u.deferred();
				console.info('attempting auth with token ', token);
				this.addRequest(rid, WS_MESSAGES_SEND.auth(rid, token)).then(function() { 
					console.log('auth successful');	d.resolve();
					}).fail(function(err) { 
						console.error('auth failure');
						d.reject();
					});
				return d.promise();
			},
			_ws_diff:function(diffid) { 
				var token = this.box._getCachedToken() || this.box._getStoredToken(), 
				    rid = this._genid(),
				    box = this.box,
				    diffhandlers = this.diffs, 
				    d = u.deferred();
				this.addRequest(rid, WS_MESSAGES_SEND.diff(rid, token, diffid)).then(function(pdata) { 
					console.log('response from diff request coming back ', pdata);
					var diffid = pdata.diffid, success = pdata.success;
					if (success) { 
						diffhandlers[diffid] = function(diffdata) { 
							console.info('main ', box.id, ' diff handler ', diffdata);
							box._diffUpdate(diffdata.data)
								.then(function() { box.trigger('update-from-master', box.getVersion()); })
								.fail(function(err) {	u.error(err); });
						};
						d.resolve();
					} else {
						console.error('diff start error', pdata);
						d.reject();
					}
				}).fail(function(err) { console.error('diff start error ', err); d.reject(); });
				return d.promise();
			},
			close: function() { 
				var ws = this._ws;		
				console.error('calling close >> ', ws);
				ws.onmessage = function() {};
				ws.onopen = function() {};
				ws.onclose = function() {};
				ws.close();
			},
			_echo:function(payload) { 
				var rid = this._genid();
				return this.addRequest(rid, WS_MESSAGES_SEND.echo(rid, payload));	
			},
			echoTest:function(size) {
				var this_ = this, packets = {};
				size = size || 100000; // 16384;
				u.range(10).map(function(x) { 
					size += 100000;
					var s = size;
					packets[s] = setTimeout(function() {  console.error('never got response for size ', s); }, 15000);
					var payload = u.guid(size), 
						rid = this_._genid(), 
						frame = WS_MESSAGES_SEND.echo(rid, payload),
						send = new Date().valueOf();
					this_.addRequest(rid, frame).then(function(response)  {
						console.log('clearing time out for ', s);
						clearTimeout(packets[s]);
						console.log('response received ', response, ' latency ', (new Date()).valueOf() - send, " msec ");
					});
				});
			}
		});

		return { Handler:IndxWebSocketHandler };
	});
