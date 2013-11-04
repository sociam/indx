define(['js/savewatcher'], function(savewatcher) {
	var u = WebBox.utils;
	console.log("U >>>>>>>>>> ", u, WebBox);
	var DEBUG = false;
	var debugSubset = function(l) {
		if (DEBUG) { return l.slice(0,5); }
		return l;
	};
	var c = new Backbone.Collection();
	var defined = u.defined;
	// collects high level statistics about the saves to provide some visual candy	
	var saveWatcher = new savewatcher.SaveWatcher();
	
	var getModel = function(graph, id) {
		if (!c.get(id)) {
			var m = graph.getOrCreate(id);
			c.add(m);
			saveWatcher.register(m);
		}
		return c.get(id);
	};	
	var doObj = function(graph, v, type) {
		var d = u.deferred();
		var mm = getModel(graph, v.id || ('object-'+(new Date()).valueOf()));
		var tval = _transform(graph, v);
		if (type && !tval.type) { tval.type = type; } 	// add type in there
		mm.set(tval); 
		d.resolve();
		return { model: mm, dfd: d.promise() };
	};

	var _transform = function(graph, obj) {
		// console.log("_transform ", obj);
		var doPrim = function(v, k) {
			if (!_.isArray(v) && typeof(v) == 'object') { return doObj(graph, v).model; }
			if (k.indexOf('_time') >= 0) {  return new Date(v); }
			return v;
		};
		return u.zip(_(obj).map(function(v,k) {
			if (!defined(v)) { return [k, undefined]; }
			if (_.isArray(v)) { return [k, v.map(function(vx) { return doPrim(vx, k); })]; 	}
			if (v.data) {	return [k, v.data.map(function(vx) { return doPrim(vx, k); })];}
			return [k, doPrim(v,k)];
		}));		
	};
	
	var actions = {
		feed: {
			path:'/me/feed',
			toModels:function(graph, els) {
				return u.when(els.map(function(item) { return doObj(graph, item, 'feed').dfd; }));
			}			
		},
		inbox : {
			path:'/me/inbox',
			toModels:function(graph, els) {
				if (!els.map) {
					console.log('got a weird els ', els);
					window.els = els;
				} else {
					return u.when(els.map(function(item) { return doObj(graph,item, 'message').dfd; }));
				}
			}
		},		
		friends : {
			path:'/me/friends',
			toModels:function(graph, els) {
				var _me = arguments.callee;
				var result = u.when(els.map(function(fid) {
					var d = u.deferred();
					if (fid && fid.id) {
						console.log('getting more info for -- ', fid.id, fid.name);
						FB.api(fid.id, function(resp) {  doObj(graph, resp, 'person').dfd.then(d.resolve).fail(d.reject);   });
					} else { d.reject(); }
					return d.promise();
				}));
				return result;
			}
		},
		statuses: {
			path:'/me/statuses',
			toModels:function(graph, resp) {
				return u.when(resp.map(function(item) { return doObj(graph, item, 'status').dfd;	}));
			}
		},		
		me : {
			path:'/me',
			toModels:function(graph, resp) {
				return doObj(graph, resp, 'person').dfd;
			}
		}		
	};


	// actual action method -- that calls the above actions
	var execAction = function(graph, action) {
		console.log('execAction being called ', graph.id, action);
		var _me = arguments.callee;
		var d = u.deferred();
		FB.api(action.path, function(resp) {
			if (resp && resp.error) { return d.resolve(); }
			if (u.defined(resp)) {
				return action.toModels(graph, resp.data ? debugSubset(resp.data) : resp)
					.then(function() {
						if (resp.paging && resp.paging.next) {
							_me(graph, _(_(action).clone()).extend({ path: resp.paging.next })).then(d.resolve).fail(d.reject);
						} else {
							d.resolve();
						}
					}).fail(function(err) {
						console.error('error coming back from toModels ', err );
						d.reject(err);
					});
			}
		});
		return d.promise();
	};	
	return {
		watcher: saveWatcher,
		actions:actions,
		execAction:execAction
	};
});
