/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular */

angular
	.module('wellbeing', ['ng','indx','infinite-scroll'])
	.directive('dayContainer', function() {
		return {
			restrict:'E',
			scope:{ day:'=' },
			templateUrl:'/apps/aditl/templates/day-container.html',
			controller:function($scope) {
				var prezero = function(n) { 
					return n < 10 ? '0'+n : n;
				};
				$scope.simpleTime = function(d) { 
					return prezero(d.getHours()) + ':' + prezero(d.getMinutes());
				};
			}
		};
	}).directive('locmap', function() {
		return {
			restrict:'E',
			replace:true,
			scope:{ location:'=' },
			template:'<div class="locmap"></div>',
			link:function(scope, element, attribute) {


				var lat = scope.location && scope.location.peek('latitude'), lon = scope.location && scope.location.peek('longitude');
				// console.log(' location >> ', scope.location, lat, lon);
				// console.log('', JSON.stringify(scope.location.attributes));
				scope.map = L.map(element[0]);

				element.attr('data-latitude', lat);
				element.attr('data-longitude', lon);
				element.attr('data-id', scope.location && scope.location.id);

				L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(scope.map);

				if (lat && lon) { 
					scope.map.setView([lat, lon], 18); 
					L.marker([lat, lon]).addTo(scope.map);
				}


					// add a marker in the given location, attach some popup content to it and open the popup
					    // .bindPopup(scope.location.peek('name') ? scope.location.peek('name') : scope.location.id)
					    // .openPopup();
			},
			controller:function($scope) {
			}
		};
	}).controller('main', function($scope, client, utils, entities) {
		var u = utils;
		$scope.days = [];
		// $scope.locations = [];
		var box, all_locs = [];	
		var sa = function(fn) { return u.safeApply($scope, fn); };
		var weekday=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
		var months = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

		var makeSegment = function(tstart, tend, segname, location) {
			var seg = { 
				tstart: tstart,
				tend: tend,
				name : segname,
				location : location,
				nike : [],
				fitbit : [],
				browsing: []
			};
			return seg;
		};

		var createDay = function(date) {
			if (!box) return;

			var dstart = new Date(date.valueOf()); dstart.setHours(0,0,0,0);
			var dend = new Date(date.valueOf()); dend.setHours(23,59,59,999);

			var day = { 
				date:date,dstart:dstart,dend:dend,
				dow: weekday[dstart.getDay()].toLowerCase(),
				dom:dstart.getDate(),
				month:months[dstart.getMonth()].toLowerCase().slice(0,3),
				segments:[] 
			};

			// segment the day by activity
			entities.activities.getByActivityType(	box, dstart, dend, ['walk','run','stay','transport'] ).then(
				function(acts) {
					var sorted = acts.concat();
					acts.sort(function(x,y) { return x.peek('tstart').valueOf() - y.peek('tstart').valueOf(); });
					console.log('ACTIVITIES for day ', dstart, ' ~~ >> ', acts, acts.map(function(act) { return act.id; }));

					// [act1]  [act2][act3]           [act4]

					_(acts).map(function(ca, i) {
						var cstart = ca.peek('tstart');
						if (i !== 0) {
							var last_end = acts[i-1].peek('tend');
							if (last_end.valueOf()-cstart.valueOf() > 60*1000) {
								sa(function() { day.segments.push(makeSegment(last_end,cstart)); });
							}
						}
						sa(function() { 
							day.segments.push(makeSegment(ca.peek('tstart'),ca.peek('tend'), ca.peek('activity'), ca.peek('waypoints')));
						});
					});

					// // filter for activities that have at least 1 waypoint
					// acts = acts.filter(function(x) { return x.peek('waypoints'); });
					// console.log('got activities for day :: ', dstart, ' > ', acts.length, acts);


					// // filter out activities that are shorter than 1 minute 
					// acts = acts.filter(function(x) { return x.peek('tend') - x.peek('tstart') > 60000; });

					// // now have activities that have at least one segment and that are at least 1 minute
					// acts.map(function(act) {  
					// 	var newseg = makeSegment( act.peek('tstart'), act.peek('tend'), act.peek('activity'), act.peek('waypoints') );
					// 	console.log('made segment >> ', newseg);
					// 	sa(function() { day.segments.push(newseg);	});
					// });
				}).fail(function(bail) {
					console.error('error getting activities >> ', bail);
				});
			return day;
		};
		$scope.generatePast = function(start_date, num_days) {
			console.log('generatePast >> ', start_date);
			var i = 1; 
			if (start_date === undefined) { 
				start_date = new Date(new Date().valueOf() + i*24*3600*1000); 
			} 
			while (i <= num_days) {
				var date = new Date(start_date.valueOf() - i*24*3600*1000);
				var cd = createDay(date);
				if (cd) { $scope.days.push(cd); }
				i++;
			}
		};
		$scope.$watch('user + box', function() { 
			if (!$scope.user) { console.log('no user :( '); return; }
			$scope.days = [];
			client.store.getBox($scope.box).then(function(_box) { 
				window.box = _box;
				box = _box;
				// box.query({type:'location'}).then(function(things) {
				// 	u.safeApply($scope, function() { 
				// 		all_locs = things.concat(); 
				// 		$scope.locations = things.slice(0,6);
				// 	});
				// }).fail(function(bail) { console.log('fail querying ', bail); });				
				// $scope.genDay();
				u.safeApply($scope, function() { $scope.generatePast(undefined,4); });
			}).fail(function(bail) { console.error(bail); });
		});
		window._s = $scope;
	});