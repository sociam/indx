/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery */

(function() {
	angular.module('aditl', ['indx','ng']).controller('facetdemo', function($scope, client, entities, utils) {
		var u = utils,
			sa = function(fn) { return u.safeApply($scope, fn); };

		$scope.$watch('boxid', function() { 
			if (!$scope.boxid) { return; }
			console.log('getting box ', $scope.boxid);
			client.store.getBox($scope.boxid).then(function(_box) {
				sa(function() { $scope.box = _box; });
			}).fail(function(bail) { console.error(bail); });
		});
		window.$s = $scope;
		window.store = client.store;
		window.en = entities;
		window.u = utils;
	});
})();