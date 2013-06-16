(function() {
	angular
		.module('webbox', ['ui'])
		.factory('webbox',function() {
			var exports = {};
			var d = exports.loaded = new $.Deferred();
			exports.safe_apply = function($scope, fn) {
				setTimeout(function() { $scope.$apply(fn); }, 0);
			};
			WebBox.load().then(function() {
				exports.u = window.u = WebBox.utils;
				exports.store = window.store = new WebBox.Store();
				exports.Obj = WebBox.Obj;
				exports.File = WebBox.File;
				exports.Box = WebBox.Box;
				exports.Store = WebBox.Store;												
				exports.store.fetch()
					.then(function() { d.resolve(exports); })
					.fail(function() {
						// TODO
						u.error('Warning: error fetching boxes - probably not logged in! thats ok');
						d.resolve(exports);
					});
			});
			return exports;
		}).factory('backbone', function() {
			
		});
}());
