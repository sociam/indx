/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular */

angular
	.module('wellbeing', ['ng','indx','infinite-scroll'])
	// .directive('dayview', function() {
	// 	return {
	// 		restrict:'E',
	// 		scope:{ day:'=' },
	// 		templateUrl:'/apps/wellbeing/templates/day.html'
	// 		controller:function($scope) {}
	// 	};
	// })
	.directive('locmap', function() {
		return {
			restrict:'E',
			replace:true,
			scope:{ location:'=' },
			template:'<div class="locmap"></div>',
			link:function(scope, element, attribute) {
				var lat = scope.location.peek('latitude'), lon = scope.location.peek('longitude');
				scope.map = L.map(element[0]).setView([lat, lon], 18);

				element.attr('data-latitude', lat);
				element.attr('data-longitude', lon);
				element.attr('data-id', scope.location.id);

				L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
				    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
				}).addTo(scope.map);

					// add a marker in the given location, attach some popup content to it and open the popup
				L.marker([lat, lon]).addTo(scope.map);
					    // .bindPopup(scope.location.peek('name') ? scope.location.peek('name') : scope.location.id)
					    // .openPopup();
			},
			controller:function($scope) {
			}
		};
	}).controller('main', function($scope, client, utils) {
		var u = utils;
		$scope.days = [];
		$scope.locations = [];
		var all_locs = [];		
		var box;

		// var genDay = function(date) { 
		// 	return {
		// 		date: date,
		// 		locations: get_things(date, {type: "location"}),
		// 		activities: get_things(date, {type:'activity'}))
		// 	};
		// };

		// $scope.genDay = function() { 
		// 	var last_day = $scope.days.slice($scope.days.length - 1),
		// 		late_date = last_day && last_day.date || new Date();

		// 	genDay(last_date);
		// };

		var genLocs = function() {
			console.log('genlocs >> ', $scope.locations.length, all_locs.length);
			if ($scope.locations.length < all_locs.length) {
				$scope.locations.push(all_locs[$scope.locations.length]);
			}
		};
		$scope.$watch('user + box', function() { 
			if (!$scope.user) { console.log('no user :( '); return; }
			$scope.days = [];
			box = client.store.getBox($scope.box).then(function(_box) { 
				window.box = _box;
				box = _box;
				console.log('querying ----------- > ');
				box.query({type:'location'}).then(function(things) {
					console.log('things');
					u.safeApply($scope, function() { 
						console.log("I GOT THE THINGS >> ", things);
						all_locs = things; 
						$scope.locations = things;
					});
				}).fail(function(bail) { console.log('fail querying ', bail); });				
				// $scope.genDay();
			}).fail(function(bail) { console.error(bail); });
		});

	});