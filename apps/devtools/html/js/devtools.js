angular
	.module('devtools', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('getting box', $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		window.s = client.store;
		window.create_random_objs = function(n, fn) {
			var ids = u.range(n || 100).map(function() {
				return 'random-generated-'+u.guid();
			});
			window.box.get_obj(ids).then(function(models) {
				console.log('models >> ', models);
				models.map(function(m) {
					if (fn) { m.set(fn()); }
					else {
						m.set({i:Math.random(), name:u.guid()});
					}
					m.save();
				});
			}).fail(function(x) { console.log(x); });
		};
	});
