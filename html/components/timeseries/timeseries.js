/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() {
	console.log('>>>>>>>>>>> TIMESERIES #1');
	angular
		.module('webbox-widgets')
		.directive('timeseries', function() {
			return {
				restrict: 'E',
				scope:{model:"=model", box:"=box"}, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/timeseries/timeseries.html',
				controller:function($scope, $attrs, webbox) {
					// incoming :
					//   $scope.model <- model 
					//   $scope.box <- from property
					//   $attr.propert[ies] <- properties to plot

					console.log("TIMESERIES INIT >>>>>> ");
					var update = function() {
						console.log('TIMESERIES UPDATE ');
						try {
							// run from inside safe apply
							var ps = $attrs.properties.split(',').map(function(x) { return x.trim(); });
							$scope.hello = ' '+ ps.map(function(p) {
								var v = $scope.model.get(p);
								return p + ": " + (v ? v.toString() : 'none');
							}).join(',');
						} catch(e) {
							console.error(e);
						}
					};					
					webbox.loaded.then(function() {
						$scope.$watch('model', update);
						$scope.$watch('box', update);						
					});
					webbox.safe_apply($scope, update);
				}
			};
		});

}());
