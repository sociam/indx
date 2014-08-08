/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

angular.module('test',['indx'])
	.controller('main', function($scope, client, utils, transformers) { 
		console.log('channeltest');
		var store = client.store, u = utils,
			boxes, sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		$scope.transformers = [];
		$scope.people = [];
		$scope.test = {};

		transformers.getAllBoxes().then(function(boxes) { 
			$scope.boxes = boxes;
			sa(function() { 
				console.log('boxes >> ', boxes, boxes.map(function(bb) { return bb.id; }));
				$scope.boxids = boxes.map(function(bb) { return bb.getID(); }); 
			});
		}).fail(function(err) { 
			console.error('error getting boxes >> '); 
		});

		var startTrans = function() { 
			$scope.transformers.map(function(t) { t.stop(); });
			transformers.getTransformers().then(function(chnls) { 
				sa(function() { $scope.transformers = chnls; });
				chnls.map(function(x) { 
					x.start().then(function(x) { console.log('started transformer ', x.name); });
				});
			});
		};
		$scope.defineTests = function(srcboxid, dstboxid) { 
			var d = u.deferred();
			u.when(transformers.getTestDefs(srcboxid,dstboxid).map(function(td) { 
				var dd = u.deferred();
				store.getBox(srcboxid).then(function(box) { 
					transformers.define('test-transformer-'+td.name,box,td).then(dd.resolve).fail(function() { 
						console.error('error defining transformer', err); 
						dd.reject();
					});
				}).fail(dd.reject);
				return dd.promise();
			})).then(function() { 
				console.log('all defined');
				startTrans();
			});
		};
		$scope.deleteTransformer = function(c) { 
			// called with the obj, not with the thing.
			c.obj.destroy().then(function(x) { 	startTrans(); }).fail(function(err) { console.error('error deleting ', err); });
		};

		$scope.createPerson = function(boxname) {
			var box = $scope.boxes.filter(function(x) { return x.id === boxname; })[0],
				uid = 'test-person-'+u.guid();
			box.obj(uid).set({ given_name:'Fred'+u.guid(4).toLowerCase(), surname: 'Smith'+u.guid(6).toLowerCase(), type:"Person", age:Math.random()*100 }).save().then(function(x) { 
				sa(function() { $scope.people.push(x);  });
			});
		};

		startTrans();
		window.$s = $scope;
		window.store = store;
		window.chan = transformers;
	});