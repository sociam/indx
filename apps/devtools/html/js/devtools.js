angular
	.module('devtools', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var u = utils;
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

		$.get('api/tests', function (r) {
			$scope.tests = _.map(r.response, function (test) {
				var name = test.split('.')[0];
				return {
					name: name
				}
			});
		});

		$.get('api/docs/list_docs', function (r) {
			$scope.docs = r.response;
		});

		$scope.building_docs = {};
		$scope.build_doc = function (doc) {
			$scope.building_docs[doc.name] = true;
			$.post('api/docs/generate_doc?name=' + doc.name, function (r) {
				$scope.building_docs[doc.name] = false;
				Object.keys(r.response).forEach(function (k) {
					doc[k] = r.response[k];
				});
				u.safe_apply($scope);
			});
		}

		window.$scope = $scope;
	});
