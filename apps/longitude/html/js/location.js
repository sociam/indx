angular
	.module('sensors', ['ui','indx'])
	.controller('location', function($scope, client, utils) {
		
		var box, u = utils, s = client.store;
		$scope.loading = 0;

		var initialiseMap = function() { 
			$scope.map = L.map($('#map')[0]).setView([51.505, -0.09], 13);
			
			L.tileLayer('http://{s}.tile.cloudmade.com/285675b50972436798d67ce55ab7ddde/997/256/{z}/{x}/{y}.png', {
				attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
				maxZoom: 18
			}).addTo($scope.map);
			
			// feedback
			var chooseMePopup = (new L.Popup());

			var $injector = angular.injector(['ng', 'sensors']);
			$injector.invoke(function($rootScope, $compile) {
				var c = $compile('<div class="btn" ng-click="setLocationButton()">Set location</div>')($scope);
				chooseMePopup.setContent(c[0]);				
			});

			var chooseMeMarker = new L.Marker([51.505, -0.09]);
			$scope.chooseMeMarker = chooseMeMarker;
			chooseMeMarker.bindPopup(chooseMePopup);			
			$scope.map.on('click', function(c) {
				var ll = $scope.map.layerPointToLatLng(c.layerPoint);
				chooseMeMarker.setLatLng(ll);
				chooseMeMarker.addTo($scope.map);
				chooseMeMarker.togglePopup();
				return false;				
			});
			$scope.setLocationButton = function() {
				var ll= chooseMeMarker.getLatLng();
				$scope.updateLogger([ll.lat, ll.lng]);
			};			
		};

		var readingsSortedByTime = function(locs) {
			locs = locs.concat([]);
			locs.sort(function(x,y) { return y.get('start')[0] - x.get('start')[0]; });
			return locs;
		};
		var getLocation = function() {			
			var d = u.deferred();
			navigator.geolocation.getCurrentPosition(d.resolve, d.reject, {timeout: 1500});
			return d.promise();
		};

		// utilities used by html5
		$scope.toDateString = function(d) {
			// console.log('to date string ', d, typeof(d));
			return (new Date(d)).toDateString();
		};
		$scope.toTimeString = function(d) {
			// console.log('to time string ', d, typeof(d));
			return (new Date(d)).toLocaleTimeString();
		};		
		
		// called by the refresh button
		$scope.locate = function() {
			$scope.loading++;
			$scope.error = undefined;			
			getLocation().then(function(x) {
				u.safeApply($scope, function() { 
					$scope.loading--;				
					u.debug("detected location >> ", x.coords);
					u.safeApply($scope, function() {
						$scope.location = _(x.coords).clone();
						$scope.updateLogger();
					});
				});
			}).fail(function(e) {
				u.safeApply($scope, function() { 				
					$scope.loading--; u.error('couldnt locate ', e);
					$scope.error = 'Could not estimate location ' + e.message;
				});
			});
		};

		

		// utility used by updateLogger
		var dist = function(ll1, ll2) {
			return Math.sqrt(_.zip(ll1, ll2).map(function(l) { return Math.pow(l[1]-l[0], 2); }).reduce(function(x, y) { return x + y; }));
		};

		// watch out for lcoation changes 
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
		// updates the location log
		$scope.updateLogger = function(forceNew) {
			if (!box) { u.debug('no box, skipping '); return ;}
			var loc = $scope.location && [$scope.location.latitude, $scope.location.longitude];
			console.log(' loc >> ', loc);
			if (!(loc || forceNew)) { u.debug('no location, skipping '); return; }
			console.log("UPDATING LOCATION LOG >>>>>>>>> ");
			box.getObj('myLocationDiary').then(function(diary) {
				var now = (new Date()).valueOf(),
					history = readingsSortedByTime(diary.get('locations') || []),
					reading = history && history[0],
					readloc = reading && [(reading.get('latitude') || [0])[0],(reading.get('longitude') || [0])[0]	];
				
				console.log("MY LOCATION DIARY ", history.length, diary);

				if (reading && !forceNew && (dist(readloc,loc) < 0.02)) {
					u.debug('updating existing location  >> ');
					reading.set({end:now});
					reading.save();
				} else {
					u.debug('minting new location  >> ');
					// make new readin
					box.getObj('my-location-' + (new Date()).valueOf()).then(function(o) {
						console.log('loc ', loc);
						o.set({
							start : now,
							end: now,
							latitude : forceNew && forceNew[0] || loc[0],
							longitude: forceNew && forceNew[1] || loc[1],
						});
						history.push(o);
						diary.set({'locations' : history });
						o.save()
							.then(function() {
								console.log('diary save >> !!!!!!!!!!!!!!!!!!!!! ');
								diary.save()
									.then(function(h) { u.debug('updated location diary' + history.length); })
									.fail(function(e) { u.error('could not update history '); });
							}).fail(function(e) { u.error('could not create new location ' + e); });
					});
				}
			});
		};

		$scope.byDay = [];

		var topOfDay = function(dlong) {
			var dd = (new Date(dlong)).toDateString();
			return new Date(dd).valueOf();			
		};
		$scope.hoverHistory = function(lat,lng) {
			console.log('hover history ', lat, lng);
			var hoverltlng = new L.LatLng(lat,lng);
			$scope.map.panTo(hoverltlng);
			$scope.chooseMeMarker.setLatLng(hoverltlng);
			$scope.chooseMeMarker.addTo($scope.map);
		};		
		var updateDiaryView = function(diary) {
			var locs = readingsSortedByTime(diary.get('locations') || []);
			console.log('update diary view >> ', locs.length);
			var bd = [];
			var curDay;
			locs.map(function(loc) {
				var start = loc.get('start')[0];
				if ( curDay === undefined || (topOfDay(start) > curDay.start)) {
					if (curDay) { bd.push(curDay); }
					curDay = { start: topOfDay(start), locations:[loc] };
				} else {
					curDay.locations.push(loc);
				}
			});
			if (curDay) { bd.push(curDay); }
			u.safeApply($scope,function(){
				$scope.byDay = bd;
				console.log(' >>>> by day is ', bd);
			});			
		};		
		var updateDiaryWatcher = function() {
			$scope.byDay = [];
			if (!box) { u.debug('no box, skipping '); return ;}
			console.log("UPDATE DIARY WATCHER >> ");
			box.getObj('myLocationDiary').then(function(diary) {
				console.log('locations of diary >> ', diary, diary.get('locations'));
				diary.on('change', function() {
					console.log('diary change !! ');
					updateDiaryView(diary);
				});
				updateDiaryView(diary);
			});
		};
		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('selected ', $scope.selectedUser, $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(b) {
					box = b; $scope.updateLogger();
					updateDiaryWatcher();
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		initialiseMap();
		window.s = client.store;
	});
