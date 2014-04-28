/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery */

angular
	.module('aditl', ['ng','indx','infinite-scroll','ngAnimate'])
	.factory('dateutils', function() { 
		return {
			weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
			months: [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ],
			dayAfter:function(d) { 	return new Date(d.valueOf() + 24*3600*1000);},
			dayBefore:function(d) { return new Date(d.valueOf() - 24*3600*1000);},
			isToday : function(d) { 
				var today = new Date();
				return d !== undefined && d.getDate() == today.getDate() && d.getYear() == today.getYear() && d.getMonth() == today.getMonth();
			}
		};
	}).directive('dayContainer', function() {
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
				$scope.isHigh = function(v, range) {};
				$scope.isMedium = function(v, range) {};
				$scope.isLow = function(v, range) {};
				$scope.decodeThumb = function(th) { 
					console.log('decodethumb >> ', th.length, _(th).isArray());
					return th && th.join('') || ''; // decodeURIComponent(th);
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
	}).controller('main', function($scope, client, utils, dateutils, entities) {
		console.log('maaaaaaaaaaaaaaaaaaaaaaain');
		var u = utils;
		$scope.days = [];
		// $scope.locations = [];
		var box, all_locs = [];	
		var sa = function(fn) { return u.safeApply($scope, fn); };

		var getBrowsingTopDocs = function(tstart,tend) {
			var d = u.deferred();
			entities.activities.getByActivityType(box,tstart,tend,['browse']).then(function(reads) { 
				console.log('READS[', tstart, '-', tend, '] >> ', reads);
				var docsbyid = {};
				var timebydoc = {};
				reads.map(function(read) { 
					var doc = read.peek('what'), tstart = read.peek('tstart'), tend = read.peek('tend');
					if (doc) {
						docsbyid[doc.id] = doc;
						timebydoc[doc.id] = (timebydoc[doc.id] ? timebydoc[doc.id] : 0) + (tend-tstart);
					}
				});
				var docids = _(timebydoc).keys();
				docids.sort(function(a,b) { return timebydoc[b] - timebydoc[a]; });
				d.resolve(docids.map(function(xx) { return docsbyid[xx]; }));
			});
			return d.promise();
		};


		var getNikeFuel  = function(tstart,tend) {
			var d = u.deferred();
			jQuery.when(
				entities.activities.getNikeStepsPerMin(box, tstart, tend),
				entities.activities.getNikeCaloriesPerMin(box, tstart, tend),
				entities.activities.getNikeFuelPerMin(box, tstart, tend)
			).then(function(steps, calories, fuel, stars) {
				// laura help me out here :) 
				var totals = {};
				totals.steps = steps && steps.length && steps.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.calories = calories && calories.length && calories.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.fuel = fuel && fuel.length && fuel.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				// totals.stars = stars && stars.length && stars.reduce(function(x,y) { return x.peek('val') + y.peek('val'); }, 0);
				d.resolve(totals);
			}).fail(d.reject);
			return d.promise();
		};

		var getFitBitMetrics  = function(tstart,tend) {
			var d = u.deferred();
			jQuery.when(
				entities.activities.getFitbitStepsPerMin(box, tstart, tend),
				entities.activities.getFitbitCaloriesPerMin(box, tstart, tend),
				entities.activities.getFitbitDistancePerMin(box, tstart, tend),
				entities.activities.getFitbitFloorsPerMin(box, tstart, tend),
				entities.activities.getFitbitElevationPerMin(box, tstart, tend)
			).then(function(steps, calories, distance, floors, elevation) {
				// laura help me out here :) 
				// console.log("FITBITS >> ", steps);
				var totals = {};
				totals.steps = steps && steps.length && steps.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.calories = calories && calories.length && calories.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.distance = distance && distance.length && distance.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.floors = floors && floors.length && floors.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				totals.elevation = elevation && elevation.length && elevation.reduce(function(x,y) { return x + parseFloat(y.peek('value')); }, 0);
				d.resolve(totals);
			}).fail(d.reject);
			return d.promise();
		};

		var makeSegment = function(tstart, tend, segname, location) {
			var seg = { 
				tstart: tstart,
				tend: tend,
				name : segname,
				location : location,
				nike : {},
				fitbit : {},
				tweets : [],
				documents: []
			};

			return seg;
		};

		var populateSegment = function(seg) {
			var tstart = seg.tstart, tend = seg.tend;

			getBrowsingTopDocs(tstart,tend).then(function(topdocs) {
				sa(function() { seg.documents = topdocs.slice(0,20); });
			});

			// getNikeFuel(tstart,tend).then(function(total) {
			// 	sa(function() { seg.nike = total; });
			// }).fail(function(bail) { console.log('couldnt get fuel '); });

			// getFitBitMetrics(tstart,tend).then(function(total) {
			// 	sa(function() {  seg.fitbit = total; });
			// }).fail(function(bail) { console.log('couldnt get fitbit '); });

			// entities.documents.getMyTweets(box, tstart, tend).then(function(tweets){
			// 	console.log('TWEETS for the segment [', tstart, '-', tend, '] >> ', tweets);
			// 	sa(function() {  seg.tweets = tweets; });
			// });

		};

		var createDay = function(date) {
			if (!box) return;
			var dstart = new Date(date.valueOf()); dstart.setHours(0,0,0,0);
			var dend = new Date(date.valueOf()); dend.setHours(23,59,59,999);
			var todaystart = new Date(); todaystart.setHours(0,0,0,0);

			var day = { 
				date:date,dstart:dstart,dend:dend,
				dow: dateutils.weekday[dstart.getDay()].toLowerCase(),
				dom: dstart.getDate(),
				month:dateutils.months[dstart.getMonth()].toLowerCase().slice(0,3),
				segments:[] 
			};

			// segment the day by activity
			entities.activities.getByActivityType(	box, dstart, dend, ['walking','cycling','running','stay','transport'] ).then(
				function(acts) {
					var sorted = acts.concat();
					sorted = sorted.filter(function(x) { 
						if (!(x.peek('tstart') || x.peek('tend'))) {
							console.error('something is messed with ', x);
						}
						return x.peek('tstart') !== undefined && x.peek('tend') !== undefined; });
					sorted.sort(function(x,y) { return x.peek('tstart').valueOf() - y.peek('tstart').valueOf(); });
					console.log('ACTIVITIES for day ', dstart, ' ~~ >> ', acts.length, sorted.length, sorted.map(function(act) { return act.id; }));

					// [act1]  [act2][act3]           [act4]

					var segments = [];

					_(sorted).map(function(ca, i) {
						var cstart = ca.peek('tstart');
						if (i !== 0) {
							var last_end = sorted[i-1].peek('tend');
							if (last_end.valueOf() > cstart.valueOf()) { 
								cstart = new Date(last_end.valueOf())+ 1;
							}
							if (last_end.valueOf()-cstart.valueOf() > 60*1000) {
								sa(function() { segments.push(makeSegment(last_end,cstart)); });
							}
						}

						var newseg = makeSegment(ca.peek('tstart'),ca.peek('tend'), ca.peek('activity'), ca.peek('waypoints'));
						newseg.moves = {};
						newseg.moves.calories = ca.peek('calories');
						newseg.moves.steps = ca.peek('steps');
						newseg.moves.distance = ca.peek('distance');							
						segments.push(newseg);
					});


					if (dateutils.isToday(date)) {
						// console.log('today is true !! ', segments.length > 0);
						if (segments.length > 0) { 
							var last_end = segments[segments.length-1].tend;
							var last_shouldbe = (new Date()); 
							segments[segments.length - 1].tend = last_shouldbe;
						} 
					}

					sa(function() { day.segments = day.segments.concat(segments); });

					segments.map(function(x) { populateSegment(x); });

					// add a segment for now
					// var last_end = (sorted.length && sorted[sorted.length-1].peek('tend') || dstart);
					// var last_shouldbe = new Date(Math.min( (new Date()).valueOf(), dend.valueOf() ));
					// if (last_shouldbe.valueOf() - last_end.valueOf() > 60*1000) {
					// 	sa(function() { 
					// 		// test
					// 		sorted[sorted.length-1].set({tend:last_shouldbe});
					// 		// day.segments.push(makeSegment(last_end, last_shouldbe));
					// 	});
					// }

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
			console.log('user box change ', $scope.user, ' -- ', $scope.box);
			if (!$scope.user) { console.log('no user :( '); return; }
			if (!$scope.box) { console.log(' no box :( '); return; }
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
				u.safeApply($scope, function() { $scope.generatePast(undefined,10); });
			}).fail(function(bail) { console.error(bail); });
		});
		window._s = $scope;
		window.entities = entities;
		window.store = client.store;
	});