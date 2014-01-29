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

			}
		};
	}).directive('locmap', function() {
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
	}).controller('main', function($scope, client, utils, entities) {
		var u = utils;
		$scope.days = [];
		// $scope.locations = [];
		var box, all_locs = [];	

		var weekday=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
		var months = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

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
					console.log('got activities > ', acts);
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