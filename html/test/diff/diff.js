/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

angular.module('test',['indx'])
	.controller('main', function($scope, client, utils) { 
		
		var store = client.store, u = utils,
			boxes, sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		var getAllBoxes = function() { 
		    // select only the boxes that we have read perms on
		    var D = u.deferred();
		    store.getBoxList().then(function(boxlist) {
		    	console.log('boxlist .. ', boxlist);
		    	try {
			        u.when(boxlist.map(function(bid) { 
			        	console.log('bid ', bid);
			            var d = u.deferred();
			            // if we fail, that means we probably don't have read perms, so just skip
			            store.getBox(bid).then(function(box) { 
			            	console.log('got box ', bid); 
			            	d.resolve(box); 
			            }).fail(function(err) { 
			            	console.log('didnt get box ', bid, err);
			            	d.resolve(); 
			            });
			            return d.promise();
			        })).then(function(boxes) { 
			        	console.log('then boxes!', boxes);
			        	D.resolve(boxes.filter(function(x) { return x; })); 
			        }).fail(D.reject);
			    } catch(e) { 
			    	console.error("BAH", e);
			    }
		    }).fail(D.reject);
		    return D.promise();
		};

		$scope.rawdiffs = [];
		$scope.diffs = {};

		getAllBoxes().then(function(boxes) { 
			sa(function() { $scope.boxes = boxes; });
			boxes.map(function(b) { 
				$scope.diffs[b.id] = {};
				b.on('diff', function(data) { 
					console.log('DIFF!!! >> ', data);
				});
			});
			console.log('boxes >> ', boxes);
			setInterval(function() { 
				var oid = 'difftest' + u.guid(8);
				boxes[0].obj(oid).set({test:'hello'}).save().then(function(o) { 
					console.log('obj ', o);
					console.log('made a thing in ', boxes[0], o);
				});
			}, 3000);			
		});
		console.log('ready ');
		window.store = store;
	});