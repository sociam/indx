angular
	.module('exporter', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
		$scope.format = 'json';
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('getting box', $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(b) {
					box = b;
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
			console.log("saving in the format : ", $scope.format);
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

		$scope.createContextObj = function() {
			context = {};
			// what is the box url in indx? 
			context["vocab"]=client.store.get('server_host')+"/box/"+$scope.selectedBox+"/";
			// what else should go in context? 
			return context
		};

		var parseValue = function(val) {
			if (Array.isArray(val)) {
				return val.map(function(o) {
					if (o.hasOwnProperty("@id")) {
						return o["@id"];
					} 
					if (o.hasOwnProperty("@value")) {
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
				out = {}
				out["@context"] = $scope.createContextObj();
				// save the box as a graph? with @graph? or not needed ...	
				ids = Object.keys(obs);
				out["@graph"] = ids.map(function(oid) {
					console.log("processing object ",obs[oid]);
					obj = obs[oid];
					newobj = {};
					keys = Object.keys(obj);
					for (i in keys) {
						key = keys[i];
						val = obj[keys[i]];
						if (Array.isArray(val)) {
							newVal = val.map(function(o) {
								if (o.hasOwnProperty("@id")) {
									return {"@id":o["@id"]};
								} else {
									return o;
								}
							});
							newobj[key] = newVal;
						} else {
							newobj[key] = val;
						}
					}
					return newobj;
				});				
				return JSON.stringify(out);	
			},
			'ntriples' : function(obs) {
				console.log("serializing list to turtle");
				defaultPrefix = "@prefix : <"+client.store.get('server_host')+"/box/"+$scope.selectedBox+"/"+"> .\n";
				indxPrefix = "@prefix indx: <http://sociam.org/ontology/indx/> .\n";
				return defaultPrefix + indxPrefix + "\n"+ toN3(obs);
			}, 
			'csv' : function(obs) {
				console.log("serializing list to csv");
				return toCSV(obs);
			}
		};

		var toCSV = function(obs) {
			ids = Object.keys(obs);
			cols=["@id"]
			ids.map(function(oid) {
				keys = Object.keys(obs[oid]);
				for (i in keys) {
					key = keys[i];
					if (cols.indexOf(key) == -1) {
						cols.push(key);
					}
				}
			});
			console.log(cols);
			rows = ids.map(function(oid) {
				obj = obs[oid];
				row = [];
				for (i in cols) {
					if (obj.hasOwnProperty(cols[i])) {
						val = parseValue(obj[cols[i]]);
						if (Array.isArray(val) && (val.length > 1)) {
							row.push('"['+val.toString()+']"');
						} else {
							row.push('"'+val.toString()+'"');
						}
					} else {
						row.push("");
					}
				}
				return row;
			});
			return cols + "\n" +rows.join("\n");
		};

		var toN3 = function(obs) {
			ids = Object.keys(obs);
			triples = ids.map(function(oid) {
				obj = obs[oid];
				objTriples = [":"+oid+" a indx:Object"];
				keys = Object.keys(obj);
				for (i in keys) {
					key = keys[i];
					if (key != "@id") {
						console.log(obj[key]);
						if (Array.isArray(obj[key])) {
							values = obj[key].map(function(o) {
								if (o.hasOwnProperty("@id")) {
									return ":"+o["@id"]; // make this check when it's a absolute or relative url
								} 
								if (o.hasOwnProperty("@value")) {
									return "\""+o["@value"]+"\"";
								}
							});
							objTriples.push("\t :"+key + " "+values.toString());
						} else {
							objTriples.push("\t :"+ key+ " "+ parseValue(obj[key]).toString());
						}
					}
				}
				return objTriples.join(";\n") + " .";
			});
			return triples.join("\n");
		}

		var file_formats = {
			'json' : 'json',
			'jsonld' : 'jsonld',
			'ntriples' : 'nt', 
			'csv' : 'csv'
		};

	});
