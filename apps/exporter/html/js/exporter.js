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

		var setWait = function(b) {
			console.log
			u.safeApply($scope, function() { $scope.wait = b;	});
		};

		$scope.doSave = function() {
			setWait(true);
			return $scope.save().pipe(function() { setWait(false); });
		};

		$scope.save = function() {
			var dd = u.deferred();
			console.log("box has : ", $scope.objs.length);
			console.log("the format : ", $scope.format);

			// box.getObj($scope.objs).then(function(objects) {
			// 	u.safeApply($scope, function() {
			// 		$scope.boxData = $scope.serializers[$scope.format](objects);
			// 		$scope.fileext = file_formats[$scope.format];
			// 	});
			// 	dd.resolve();
			// }).fail(dd.reject);
			box.query({}, "*").then(function(response) {
				objects = response["data"];
				u.safeApply($scope, function() {
					$scope.boxData = $scope.serializers[$scope.format](objects);
					$scope.fileext = file_formats[$scope.format];
				});
				dd.resolve();
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

		var parseValue = function(val) {
			console.log("parsing value ", val);
			if (Array.isArray(val)) {
				return val.map(function(o) {
					if (o.hasOwnProperty("@id")) {
						return o["@id"];
					} 
					if (o.hasOwnProperty("@value")) {
						console.log(o["@type"]);
						return literalDeserialisers[o["@type"]](o["@value"]);
					}
				});
			} else {
				return val;
			}
		};
		var literalDeserialisers = {
			'': function(v) { return v; },
			"http://www.w3.org/2001/XMLSchema#integer": function(v) { return parseInt(v, 10); },
			"http://www.w3.org/2001/XMLSchema#float": function(v) { return parseFloat(v, 10); },
			"http://www.w3.org/2001/XMLSchema#double": function(v) { return parseFloat(v, 10); },
			"http://www.w3.org/2001/XMLSchema#boolean": function(v) { return v.toLowerCase() === 'true'; },
			"http://www.w3.org/2001/XMLSchema#dateTime": function(v) { return new Date(Date.parse(v)); }
		};

		$scope.serializers = {
			'json' : function(obs) {
				console.log("serializing list to json");
				ids = Object.keys(obs);
				newobs = ids.map(function(oid) {
					console.log("processing object ",obs[oid]);
					obj = obs[oid];
					newobj = {};
					keys = Object.keys(obj);
					for (i in keys) {
						newobj[keys[i]] = parseValue(obj[keys[i]]);
					}
					return newobj;
				});
				return JSON.stringify(newobs);
			},
			'jsonld' : function(obs) {
				console.log("serializing list to json-ld");
				// create a context for the list, containing as base/vocab? the url of the server/box
				context = $scope.createContextObj();
				// save the box as a graph? with @graph? or not needed ...

				return ['[',obs.join(',\n'),']'].join('\n');	
			},
			'turtle' : function(obs) {
				console.log("serializing list to turtle");
				// return toTurtle(obs);
			}, 
			'csv' : function(obs) {
				console.log("serializing list to csv");
				// return toCSV(obs);
			}
		};
		var file_formats = {
			'json' : 'json',
			'jsonld' : 'jsonld',
			'turtle' : 'ttl'
		};

	});
