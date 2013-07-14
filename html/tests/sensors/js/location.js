angular
	.module('sensors', ['ui','indx'])
	.controller('location', function($scope, client, utils) {
		
		var box, u = utils, s = client.store;
		$scope.loading = 0;

		var initialise_map = function() { 
			$scope.map = L.map($('#map')[0]).setView([51.505, -0.09], 13);
			L.tileLayer('http://{s}.tile.cloudmade.com/285675b50972436798d67ce55ab7ddde/997/256/{z}/{x}/{y}.png', {
				attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
				maxZoom: 18
			}).addTo($scope.map);


			// feedback
			var choose_me_popup = (new L.Popup());

			var $injector = angular.injector(['ng', 'sensors']);
			$injector.invoke(function($rootScope, $compile) {
				var c = $compile('<div class="btn" ng-click="setLocationButton()">Set location</div>')($scope);
				choose_me_popup.setContent(c[0]);				
			});

			var choose_me_marker = new L.Marker([51.505, -0.09]);
			choose_me_marker.bindPopup(choose_me_popup);
			
			$scope.map.on('click', function(c) {
				var ll = $scope.map.layerPointToLatLng(c.layerPoint);
				console.log('got a click on layer point ', c.layerPoint, ll);				
				choose_me_marker.setLatLng(ll);
				choose_me_marker.addTo($scope.map);
				choose_me_marker.togglePopup();
				return false;				
			});

			$scope.setLocationButton = function() {
				var ll= choose_me_marker.getLatLng();
				console.log('location set ', ll);				
				$scope.update_logger([ll.lat, ll.lng]);
			};			
		};

		var readings_sorted_by_time = function(locs) {
			locs = locs.concat([]);
			locs.sort(function(x,y) { return x.get('start')[0] - y.get('start')[0]; });
			return locs;
		};
		var get_location = function() {			
			var d = u.deferred();
			navigator.geolocation.getCurrentPosition(d.resolve, d.reject, {timeout: 1500});
			return d.promise();
		};

		// utilities used by html5
		$scope.to_date_string = function(d) {
			// console.log('to date string ', d, typeof(d));
			return (new Date(d)).toDateString();
		};
		$scope.to_time_string = function(d) {
			// console.log('to time string ', d, typeof(d));
			return (new Date(d)).toLocaleTimeString();
		};		
		
		// called by the refresh button
		$scope.locate = function() {
			u.debug('locate! ');
			$scope.loading++;
			$scope.error = undefined;			
			get_location().then(function(x) {
				u.safe_apply($scope, function() { 
					$scope.loading--;				
					u.debug("location >> ", x.coords);
					u.safe_apply($scope, function() {
						$scope.location = _(x.coords).clone();
					});
					$scope.update_logger();
				});
			}).fail(function(e) {
				u.safe_apply($scope, function() { 				
					$scope.loading--; u.error('couldnt locate ', e);
					$scope.error = 'Could not estimate location ' + e.message;
				});
			});
		};


		// utility used by update_logger
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
		$scope.update_logger = function(force_new) {
			if (!box) { u.debug('no box, skipping '); return ;}
			var loc = $scope.location && [$scope.location.latitude, $scope.location.longitude];
			console.log(' loc >> ', loc);
			if (!(loc || force_new)) { u.debug('no location, skipping '); return; }
			console.log("UPDATING LOCATION LOG >>>>>>>>> ");
			box.get_obj('my_location_diary').then(function(diary) {
				var now = (new Date()).valueOf(),
					history = readings_sorted_by_time(diary.get('locations') || []),
					reading = history && history[history.length-1],
					readloc = reading && [(reading.get('latitude') || [0])[0],(reading.get('longitude') || [0])[0]	];
				
				console.log("MY LOCATION DIARY ", history.length, diary);

				if (reading && !force_new && (dist(readloc,loc) < 0.02)) {
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
							latitude : force_new && force_new[0] || loc[0],
							longitude: force_new && force_new[1] || loc[1],
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

		$scope.by_day = [];

		var top_of_day = function(dlong) {
			var dd = (new Date(dlong)).toDateString();
			return new Date(dd).valueOf();			
		};		
		var update_diary_view = function(diary) {
			var locs = readings_sorted_by_time(diary.get('locations') || []);
			console.log('update diary view >> ', locs.length);
			var bd = [];
			var cur_day;
			locs.map(function(loc) {
				var start = loc.get('start')[0];
				if ( cur_day === undefined || (top_of_day(start) > cur_day.start)) {
					if (cur_day) { bd.push(cur_day); }
					cur_day = { start: top_of_day(start), locations:[loc] };
				} else {
					cur_day.locations.push(loc);
				}
			});
			if (cur_day) { bd.push(cur_day); }
			u.safe_apply($scope,function(){
				$scope.by_day = bd;
				console.log(' >>>> by day is ', bd);
			});			
		};		
		var update_diary_watcher = function() {
			$scope.by_day = [];
			if (!box) { u.debug('no box, skipping '); return ;}
			console.log("UPDATE DIARY WATCHER >> ");
			box.get_obj('my_location_diary').then(function(diary) {
				console.log('locations of diary >> ', diary, diary.get('locations'));
				diary.on('change', function() {
					console.log('diary change !! ');
					update_diary_view(diary);
				});
				update_diary_view(diary);
			});
		};
		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b; $scope.update_logger();
					update_diary_watcher();
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		initialise_map();
		window.s = client.store;
	});
