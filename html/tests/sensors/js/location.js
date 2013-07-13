angular
	.module('sensors', ['ui','indx'])
	.controller('location', function($scope, client, utils) {
		console.log('element ', $('#map')[0]);
		$scope.map = L.map($('#map')[0]).setView([51.505, -0.09], 13), u = utils;
		L.tileLayer('http://{s}.tile.cloudmade.com/285675b50972436798d67ce55ab7ddde/997/256/{z}/{x}/{y}.png', {
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
			maxZoom: 18
		}).addTo($scope.map);
		
		var get_location = function() {			
			var d = u.deferred();
			navigator.geolocation.getCurrentPosition(d.resolve);
			return d.promise();
		};		
		$scope.locate = function() {
			get_location().then(function(x) {
				u.debug("location >> ", x.coords);
				u.safe_apply($scope, function() {
					$scope.location = _(x.coords).clone();
				});
			});
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
				}
			}
		});
		$scope.$watch('selected_box', function() { $scope.locate(); });
	});
