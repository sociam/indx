
/* base file to include for all webbox-widgets,
   including :
      modeltable
*/

(function() {
	angular
		.module('webbox-widgets', ['ui'])
		.factory('webbox',function() {
			var exports = {};
			var d = exports.loaded = new $.Deferred();
			// exports.safe_apply = function($scope, fn) {
			// 	if ($scope.$$phase) {
			// 		console.warn("safe_apply() already in $scope.$$phase --- ");					
			// 		return fn();
			// 	}
			// 	$scope.$apply(fn);
			// };
			
			exports.safe_apply = function($scope, fn) {
				setTimeout(function() { $scope.$apply(fn); }, 0);
				/*
				  var phase = $scope.$$phase || $scope.$root.$$phase;
				console.log('phase >> ', $scope, phase, $scope);
				if(phase == '$apply' || phase == '$digest') {
					if(fn && (typeof(fn) === 'function')) {
						fn();
					}
				} else {
					$scope.$apply(fn);
				}
				*/
			};

			WebBox.load().then(function() {
				exports.u = window.u = WebBox.utils;
				exports.store = window.store = new WebBox.Store();
				exports.Obj = WebBox.Obj;
				exports.File = WebBox.File;
				exports.Box = WebBox.Box;
				exports.Store = WebBox.Store;												
				window.store.fetch()
					.then(function() { d.resolve(exports); })
					.fail(function() {
						// TODO
						u.error('Warning: error fetching boxes - probably not logged in! thats ok');
						d.resolve(exports);
					});
			});
			return exports;
		});	
}());
