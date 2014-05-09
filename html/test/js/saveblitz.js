/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/
angular.module('startest', ['indx'])
	.controller('main', function($scope, client, utils) {
		var store = client.store, u = utils;

		var run = function(test_box) { 
			var N =  20, 
				ids = u.range(N).map(function(x) { return 'blitz-' + u.guid(8); });

			var os = {};
	        console.log(' preparing objects  ', ids);
	        store.getBox(test_box).then(function(box) { 
		        box.getObj(ids).then(function(objs) {

		        	console.log('setting some stuff');
	                objs.map(function(v) { v.set(''+u.guid(4), u.guid(32)); });

		        	var s = function(objs) { 
		        		if (!objs.length) { return ; }
		        		var o = objs[0], d = new Date().valueOf();
		        		o.save().then(function(x) { 
		        			console.log('save complete ', (new Date()).valueOf() - d, 'msec');
		        		}).fail(function(e) { 
		        			console.error('got error on ', o.id, objs.length, e);
		        		});
		        		setTimeout(function() { s(objs.slice(1)); }, 100); 
		        	};

		        	console.log('got all objects, now commencing save blitz');
					s(objs);

	            });
	        });
       };

       $scope.$watch('selected_box', function(boxid) {
	      	console.log('box >> ', boxid);
	      	if (boxid) { run(boxid) };
       });
	});