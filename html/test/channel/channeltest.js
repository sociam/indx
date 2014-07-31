/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

angular.module('test',['indx'])
	.controller('main', function($scope, client, utils, channels) { 
		
		var store = client.store, u = utils,
			boxes, sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		$scope.channels = [];
		$scope.people = [];
		$scope.test = {};
		channels.getAllBoxes().then(function(boxes) { 
			$scope.boxes = boxes;
			console.log("!!!!!!!!!!!!! GET ALL BOXES CONT >>>>>>>>>>>>>> ", boxes);
			sa(function() { 
				console.log('boxes >> ', boxes, boxes.map(function(bb) { return bb.id; }));
				$scope.boxids = boxes.map(function(bb) { return bb.getID(); }); 
			});
		}).fail(function(err) { console.error('error getting boxes >> '); });

		var loadChannels = function() { 
			channels.getChannels().then(function(chnls) { 
				sa(function() { $scope.channels = chnls; });
				chnls.map(function(x) { 
					x.start().then(function(x) { console.log('started channel ', x.name); });
				});
			});
		};
		$scope.defineTests = function() { 
			var d = u.deferred();
			u.when(channels.getTestDefs().map(function(td) { 
				var dd = u.deferred();
				store.getBox($scope.test.box).then(function(box) { 
					channels.define('test-channel-'+td.name,box,td).then(dd.resolve).fail(dd.reject);
				}).fail(dd.reject);
				return dd.promise();
			})).then(function() { 
				console.log('all defined');
				loadChannels();
			});
		};

		$scope.createPerson = function(boxname) {
			var box = $scope.boxes.filter(function(x) { return x.id === boxname; })[0],
				uid = 'test-person-'+u.guid();
			console.log('saving in box ', box, uid);
			box.obj(uid).set({ given_name:'Fred'+u.guid(4).toLowerCase(), surname: 'Smith'+u.guid(6).toLowerCase(), type:"Person", age:Math.random()*100 }).save().then(function(x) { 
				console.log('!!!!!!!!!!!!!! done creating ', x); 
				sa(function() { $scope.people.push(x);  });
			});
		};

		loadChannels();

		window.$s = $scope;
		window.store = store;
		window.chan = channels;
	});