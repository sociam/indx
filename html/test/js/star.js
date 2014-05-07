/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/
angular.module('startest', ['indx'])
	.controller('main', function($scope, client, utils) {
		var store = client.store, u = utils;

		var run = function(test_box) { 
			var N = 20, 
				ids = u.range(N).map(function(x) { return 'star-stress-' + u.guid(5); });

			var os = {};
	        console.log(' creates the objects  ', ids);
	        store.getBox(test_box).then(function(box) { 
	        	window.handler = box._ws._handler;
		        box.getObj(ids).then(function(objs) {
	                objs.map(function(v) { os[v.id] = v; });
	                   var saved =  objs.map(function(o) {
	                        var allbutme = _(os).omit(o.id);
	                        u.assert(_(allbutme).size() ==  N-1, "allbutme size is not N-1" + (N-1));	                        
	                        // o.set(allbutme);
	                        // console.log('setting allbutme ', allbutme);
	                        // o.set('all', objs);
	                        o.set('hi', u.range(100).map(function(x) { return Math.random(); }));
	                        return o.save();
	                    }); 
	                    u.when(saved).then(function() {
	                        console.info('done saving!!!!!!!!!!!!!!');
	                    }).fail(function(err) { 
	                        console.error('fail saving', err);
	                        u.assert(false, 'failed');
	                    });
	                });
	            });
       };

       $scope.$watch('selected_box', function(boxid) {
	      	console.log('box >> ', boxid);
	      	if (boxid) { run(boxid) };
       });
	});