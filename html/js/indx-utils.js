(function() {
	angular
		.module('indx')
		.factory('utils',function() {
			var DEBUG=0, INFO=1, LOG=2, WARN=3, ERROR=4, DEBUG_LEVEL = DEBUG;
			return {
				DEBUG_LEVELS: { INFO:INFO, LOG:LOG, WARN:WARN, ERROR:ERROR },
				setDebugLevel:function(lvl) {	DEBUG_LEVEL = lvl; return lvl; },
                uuid: function(){ return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});},
				guid: function(len) {
					len = len || 64;
					var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ-';
					return this.range(0,len-1).map(function(x) {
						return alpha[Math.floor(Math.random()*alpha.length)];
					}).join('');
				},
				uniqstr:function(L) {
					var o = {}, i, l = L.length, r = [];
					for(i=0; i<l;i+=1) { o[L[i]] = L[i]; }
					for(i in o) { r.push(o[i]);	}
					return r;
				},
				dmap: function(L, fn) {
					if (L.length === 0) { return this.dresolve([]); }
					var d = this.deferred(), this_ = this;
					fn(L[0]).then(function(result) {
						this_.dmap(L.slice(1), fn).then(function(rest) {
							d.resolve([result].concat(rest));
						}).fail(d.reject);
					}).fail(d.reject);
					return d.promise();
				},
				safeApply: function($scope, fn) { setTimeout(function() { $scope.$apply(fn); }, 0); },
				log : function() { try { if (DEBUG_LEVEL >= LOG) { console.log.apply(console,arguments);  }} catch(e) { } },
				warn : function() { try { if (DEBUG_LEVEL >= WARN) { console.warn.apply(console,arguments);  }} catch(e) { } },
				debug : function() { try { if (DEBUG_LEVEL >= DEBUG) { console.debug.apply(console,arguments); }} catch(e) { } },
				error : function() { try { if (DEBUG_LEVEL >= ERROR) { console.error.apply(console,arguments); }} catch(e) {}},
				isInteger:function(n) { return n % 1 === 0; },
				deferred:function() { return new $.Deferred(); },
				chunked:function(l,n) {
					return this.range(Math.floor(l.length / n) + (l.length % n === 0 ? 0 : 1)).map(function(ith) { 
						var start = ith*n;
						return l.slice(start, start+n);
					});
				},
				shake:function(el, times, px) {
					var d = new $.Deferred(), l = px || 20;
					for (var i = 0; i < 4; i++) {
						$(el).animate({'margin-left':"+=" + (l = -l) + 'px'}, 50);
					}
					// todo
					d.resolve();
					return d.promise();
				},
				dresolve:function(val) {
					var d = new $.Deferred();
					d.resolve(val);
					return d.promise();
				},
				dreject:function(err) {
					var d = new $.Deferred();
					d.reject(err);
					return d.promise();
				},
				whend:function(deferredArray) { return $.when.apply($,deferredArray); },
				t:function(template,v) { return _(template).template(v); },
				assert:function(t,s) { if (!t) { throw new Error(s); }},
				TO_OBJ: function(pairs) { var o = {};	pairs.map(function(pair) { o[pair[0]] = pair[1]; }); return o; },
				dict: function(pairs) { var o = {};	pairs.map(function(pair) { o[pair[0]] = pair[1]; }); return o; },
				flatten:function(l) { return l.reduce(function(x,y) { return x.concat(y); }, []); },
				DEFINED:function(x) { return (!_.isUndefined(x)) && x !== null; },
				defined:function(x) { return (!_.isUndefined(x)) && x !== null; },
				indexOfUkPostcode:function(s) {
					var re = /^([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z])))) {0,1}[0-9][A-Za-z]{2})$/g;
					return s.search(re);
				},
				NotImplementedYet:function() {
					throw new Error('Not Implemented Yet');
				},
				getParameterByName: function(name) {
					name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
					var regexS = "[\\?&]" + name + "=([^&#]*)";
					var regex = new RegExp(regexS);
					var results = regex.exec(window.location.search);
					if (results === null)
						return "";
					else
						return decodeURIComponent(results[1].replace(/\+/g, " "));
				},
				range:function(l,h) {
					var a = [];
					if (_.isUndefined(h)) { h = l; l = 0; }
					for (var i = l; i < h; i++) { a.push(i); }
					return a;
				},
				toNumeric:function(v) {
					if (_(v).isNumber()) { return v ; }
					if (typeof(v) == 'string') { return parseFloat(v, 10); }
					return undefined; // throw new Error("Could not convert ", v);
				},
				when:function(x) {
					var d = this.deferred();
					$.when.apply($,x).then(function() {	d.resolve(_.toArray(arguments)); }).fail(d.reject);
					return d.promise();
				},
				whenSteps:function(fns, failFast) {
					// executes a bunch of functions that return deferreds in sequence
					var me = arguments.callee;
					var d = new $.Deferred();
					if (fns.length == 1) { return fns[0]().then(d.resolve).fail(d.reject);	}
					fns[0]().then(function() {
						me(fns.slice(1));
					}).fail(function() {
						if (failFast === true) { return; }
						me(fn.slice(1));
					});
					return d;
				},
				hash:function(s) {
					var hash = 0;
					if (s.length === 0) { return hash; }
					for (i = 0; i < s.length; i++) {
						char = s.charCodeAt(i);
						hash = ((hash<<5)-hash)+char;
						hash = hash & hash; // Convert to 32bit integer
					}
					return hash;
				}
			};
		});
}());
