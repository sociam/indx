angular
	.module('exporter', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
		$scope.objs = [];
		$scope.format = 'json';
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('getting box', $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(b) {
					box = b;
					$scope.objs = b.getObjIDs();
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		// window.box = box;
		// window.s = client.store;

		var setWait = function(b) {
			console.log
			u.safeApply($scope, function() { $scope.wait = b;	});
		};

		$scope.doSave = function() {
			setWait(true);
			return $scope.save().pipe(function() { setWait(false); });
		};

		var serialize = function(o) {
			return object_formats[$scope.format](o);
		};

		$scope.save = function() {
			var dd = u.deferred();
			console.log("box has : ", $scope.objs.length);
			console.log("the format : ", $scope.format);

			box.getObj($scope.objs).then(function(objects) {
				var serialized = objects.map(function(o) {
					return serialize(o);
				});
				u.when(serialized).then(function() {
					console.log("serialized : ",serialized);
					u.safeApply($scope, function() {
						$scope.boxData = $scope.list_formats[$scope.format](serialized);
						$scope.fileext = file_formats[$scope.format];
					});
					dd.resolve();
				}).fail(dd.reject);
			}).fail(dd.reject);

			return dd.promise();
		};

		$scope.toFile = function() {
			saveAs(new Blob([$scope.boxData], {type: "text/plain"}), $scope.filename || $scope.selectedBox+"."+$scope.fileext );
		};

		$scope.isIdOfOther = function(s) {
			if ($scope.objs.indexOf(s) !== -1) {
				return true;
			}
			return false;
		};

		$scope.createContextObj = function() {

		};


		$scope.object_formats = {
			'json' : function(o) {
				console.log("serializing to json ", o);
				return JSON.stringify(o);
			},
			'jsonld' : function(o) {
				console.log("serializing to json-ld ", o);
				// @list if the values are multiple 
				return JSON.stringify(o);	
			},
			'turtle' : function(o) {
				console.log("serializing to turtle ", o);
				return "some turtle"
			}
		};
		$scope.list_formats = {
			'json' : function(l) {
				console.log("serializing list to json");
				return ['[',l.join(',\n'),']'].join('\n');
			},
			'jsonld' : function(l) {
				console.log("serializing list to json-ld");
				// create a context for the list, containing as base/vocab? the url of the server/box
				context = $scope.createContextObj();
				// save the box as a graph? with @graph? or not needed ...

				return ['[',l.join(',\n'),']'].join('\n');	
			},
			'turtle' : function(l) {
				console.log("serializing list to turtle");
				return l.join('\n');
			}
		};
		var file_formats = {
			'json' : 'json',
			'jsonld' : 'jsonld',
			'turtle' : 'ttl'
		};

	});
