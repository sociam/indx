/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

angular.module('test',['indx'])
	.controller('main', function($scope, client, utils, channels) { 
		
		var store = client.store, u = utils,
			boxes, sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		$scope.channels = [];
		$scope.test = {};
		$scope.boxes = channels.getAllBoxes().then(function(boxes) { 
			console.log("!!!!!!!!!!!!! GET ALL BOXES CONT >>>>>>>>>>>>>> ", boxes);
			sa(function() { 
				console.log('boxes >> ', boxes, boxes.map(function(bb) { return bb.id; }));
				$scope.boxids = boxes.map(function(bb) { return bb.getID(); }); 
			});
		}).fail(function(err) { console.error('error getting boxes >> '); });

		var loadChannels = function() { 
			channels.getChannels().then(function(chnls) { 
				sa(function() { $scope.channels = chnls; });
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

		loadChannels();

		window.$s = $scope;
		window.store = store;
		window.chan = channels;
	});