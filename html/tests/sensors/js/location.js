angular
	.module('sensors', ['ui','indx'])
	.controller('location', function($scope, client, utils) {
		
		var box, u = utils, s = client.store;
		$scope.loading = 0;
		
		$scope.map = L.map($('#map')[0]).setView([51.505, -0.09], 13), u = utils;
		L.tileLayer('http://{s}.tile.cloudmade.com/285675b50972436798d67ce55ab7ddde/997/256/{z}/{x}/{y}.png', {
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
			maxZoom: 18
		}).addTo($scope.map);
		
		var get_location = function() {			
			var d = u.deferred();
			navigator.geolocation.getCurrentPosition(d.resolve, d.reject, {timeout: 1500});
			return d.promise();
		};
		
		$scope.locate = function() {
			u.debug('locate! ');
			$scope.loading++;
			get_location().then(function(x) {
				u.safe_apply($scope, function() { 
					$scope.loading--;				
					u.debug("location >> ", x.coords);
					u.safe_apply($scope, function() {
						$scope.location = _(x.coords).clone();
					});
					update_logger();
				});
			}).fail(function(e) {
				u.safe_apply($scope, function() { 				
					$scope.loading--;	u.error('couldnt locate ', e);
				});
			});
		};

		var dist = function(ll1, ll2) {
			return Math.sqrt(_.zip(ll1, ll2).map(function(l) { return Math.pow(l[1]-l[0], 2); }).reduce(function(x, y) { return x + y; }));
		};
		
		$scope.$watch('location', function() {
			console.log('location changed', $scope.location);
			if ($scope.location) {
				var locarr = [$scope.location.latitude, $scope.location.longitude];
				$scope.map.setView(locarr, 16);
				console.log("$scope.marker ", $scope.marker);
				if (!$scope.marker) {
					$scope.marker =  L.marker(locarr).addTo($scope.map).bindPopup('I was here at ' + (new Date()).toLocaleString()).openPopup();
					console.log('marker ', $scope.marker);
				} else {
					$scope.marker.setLatLng(locarr);
					$scope.marker.setPopupContent('I was here at ' + (new Date()).toLocaleString());
				}
			}
		});

		var update_logger = function() {
			var loc = $scope.location && [$scope.location.latitude, $scope.location.longitude];
			if (!box) { u.debug('no box, skipping '); return ;}			
			if (!loc) { u.debug('no location, skipping '); return; }
			u.debug('loc >', loc);
			box.get_obj('my_location_diary')
				.then(function(diary) {
					var history = diary.get('locations') || [];
					var now = (new Date()).valueOf();
					var reading = history.length && history[history.length-1],
						readloc = [ (reading.get('latitude') || [0])[0], (reading.get('longitude') || [0])[0] ];
					
					console.log('reading >> ', readloc, loc);
					
					if (history.length && (dist(readloc,loc) < 0.2)) {
						u.debug('updating existing location  >> ');
						reading.set({end:now});
						reading.save();
					} else {
						u.debug('minting new location  >> ');
						// make new readin
						box.get_obj('my-location-' + (new Date()).valueOf()).then(function(o) {
							console.log('loc ', loc);
							o.set({
								start : now,
								end: now,
								latitude : loc[0],
								longitude: loc[1],
							});
							history.push(o);
							diary.set('locations', history);
							o.save()
								.then(function() {
									diary.save()
										.then(function(h) { u.debug('updated location diary' + history.length); })
										.fail(function(e) { u.error('could not update history '); });
								}).fail(function(e) { u.error('could not create new location ' + e); });
						});
					}
				});
		};
		
		$scope.$watch('selected_box', function() {
			$scope.locate();
			client.store.get_box($scope.selected_box)
				.then(function(b) { box = b; update_logger(); })
				.fail(function(e) { u.error('error ', e); });			
		});
		
	});
