/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() {
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
						try {
							// run from inside safe apply
							var ps = $attrs.properties.split(',').map(function(x) { return x.trim(); });
							$scope.hello = ' '+ ps.map(function(p) {
								var v = $scope.model.get(p);
								return p + ": " + (v ? v.toString() : 'none');
							}).join(',');
							console.log('TIME SERIES UPDATE > ', $scope.hello);
							
						} catch(e) {
							console.error(e);
						}
					};
					var context = { id : Math.random() };
					var old_model, old_box;
					var listen_and_update = function() {
						var model = $scope.model;
						if (old_model) { old_model.off(null, null, context); }
						if (model) {
							model.on('change', function() {
								try { $scope.$apply(update); }
								catch(e) {	webbox.safe_apply($scope, update);	}
							}, context);
							update();
						}
						old_model = model;
					};					
					webbox.loaded.then(function() {
						$scope.$watch('model', listen_and_update);
						$scope.$watch('box', listen_and_update);
					});
					webbox.safe_apply($scope, listen_and_update);
				}
			};
		});

}());
