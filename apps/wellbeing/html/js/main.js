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

				L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(scope.map);

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
		$scope.genLocs = function() {
			console.log('genlocs >> ', $scope.locations.length, all_locs.length);
			var i = 0; 
			while (i < 6 && $scope.locations.length < all_locs.length) {
				console.log('pushing ', all_locs[$scope.locations.length]);
				$scope.locations.push(all_locs[$scope.locations.length]);
				i++;
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
					u.safeApply($scope, function() { 
						all_locs = things.concat(); 
						$scope.locations = things.slice(0,6);
					});
				}).fail(function(bail) { console.log('fail querying ', bail); });				
				// $scope.genDay();
			}).fail(function(bail) { console.error(bail); });
		});

	});