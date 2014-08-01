/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

var get_username = function(store) { 
	var d = u.deferred();
	store.checkLogin().then(function(l) { 
		if (l && l.user_metadata) { 
			var um = JSON.parse(l.user_metadata);
			if (um && um.name) { return d.resolve(um.name); }
		}
		d.resolve(l.username);
	}).fail(function(err) { console.error(err); d.reject(); });
	return d.promise();
};

angular.module('timon',['indx'])
	.controller('main', function($scope, client, utils, channels) { 
		
		var store = client.store, u = utils,
			boxes, sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		$scope.followers = []; $scope.following = [];

		$scope.channels = [];
		$scope.people = [];
		$scope.test = {};
		channels.getAllBoxes().then(function(boxes) { 
			$scope.boxes = boxes;
			sa(function() { 
				$scope.boxids = boxes.map(function(bb) { return bb.getID(); }); 
			});
		}).fail(function(err) { console.error('error getting boxes >> '); });

		get_username(store).then(function(uname) { $scope.username = uname; });

		window.$s = $scope;
		window.store = store;
		window.chan = channels;
	});