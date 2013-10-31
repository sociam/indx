angular
	.module('importer', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
		$scope.output = {format:'outputRaw'};
		$scope.cols = [];
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('getting box', $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(b) {
					box = b;
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		window.box = box;
		window.s = client.store;

		if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
			$scope.error = 'The File APIs are not fully supported in this browser.';
			return;
		}
		var handleDragOver = function(evt) {
			evt.stopPropagation();
			evt.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
			console.log('drag over');
			$('.dropzone').addClass('dragover');
		};

		var findIdColumn = function() {
			var cols = $scope.cols;
			var selected = cols.filter(function(c) { return c.id; });
			if (selected.length > 0) { return selected[0].name; }
			selected = cols.filter(function(c) { return c.name.toLowerCase().trim() == 'id'; });
			if (selected.length > 0) { return selected[0].name; }
			return cols[0].name;
		};

		var remapColumns = function(src) {
			var out = {}, cols = $scope.cols;
			_(cols).map(function(c) { out[c.newname] = src[c.name];	});
			return out;
		};

		var setWait = function(b) {
			u.safeApply($scope, function() { $scope.wait = b;	});
		};

		$scope.doSave = function() {
			setWait(true);
			return $scope.save().pipe(function (x) { setWait(false); });
		};

		$scope.err = function(e) {
			u.safeApply($scope, function() { $scope.error = e.toString(); });
		};

		var filters = {
			'outputGtime' : function(objsById) {
				// get the time series, segment into offsets
				var objs = _(objsById).values(),
					t = function(o) { return Number(o[$scope.output.gtime.timecol.newname]); },
					v = function(o) { return Number(o[$scope.output.gtime.valcol.newname]); },
					channel = $scope.output.gtime.channel,
					source = $scope.output.gtime.source,
					units = $scope.output.gtime.units,
					dataId = 'gtimeseries-'+source+"-"+channel;

				objs.sort(function(o1, o2) { return t(o1) - t(o2); });
				var makeSegment = function(startObj, nextObj) {
					if (nextObj) {
						return { start : t(startObj), channel: channel, source: source, values: [ v(startObj), v(nextObj) ], delta : t(nextObj) - t(startObj) };
					}
					return { start : t(startObj), channel: channel, source: source, values: [ v(startObj) ], delta: 0};
				};

				var segments = [];
				var updateLastSegment = function(obj) {
					var segment = segments[segments.length-1];
					segment.values.push(v(obj));
				};
				var lastDelta = function() { return segments[segments.length-1].delta;	};
				var lastTime = function() { return segments[segments.length-1].start + ((segments[segments.length-1].values.length-1) * lastDelta());	};

				if (objs.length > 0) {
					segment = makeSegment(objs[0], objs.length > 1 ? objs[1] : undefined);
					segments.push(segment);
				}

				for (var i = 2; i < objs.length; i++) {
					// requires: at least 1 segment
					var obj = objs[i];
					console.log("i >> ", i, obj, t(obj), lastTime(), segments[segments.length-1],  lastDelta());

					if (t(obj) - lastTime() !== lastDelta()) {
						// uh oh difference, make new segemnt
						console.log('new segment! ', t(obj) - lastTime(), lastDelta());
						segments.push(makeSegment(objs[i], objs[++i]));
					} else {
						updateLastSegment(obj);
					}
				}
				var segmentsById = u.dict(segments.map(function(s) { return ["gtime-segment-" + [s.channel, s.source, s.start].join('-'), s]; }));
				var dsave = u.deferred(), d = u.deferred();
				box.getObj(_(segmentsById).keys()).then(function(segModels) {
					var saved = segModels.map(function(m) {
						u.assert(segmentsById[m.id], "something went wrong :(");
						m.set(segmentsById[m.id]);
						return m.save();
					});
					u.when(saved).then(function() { dsave.resolve(segModels); });
				});

				dsave.then(function(segModels) {
					d.resolve(u.dict([[dataId, { source:source, channel:channel, units:units, segments:segModels } ]]));
				});
				return d.promise();
			},
			'outputGannotation': function(objsById) {
				var todate = function(n) {
					if (isNaN(Number(n))) { return new Date(n); }
					return new Date(Number(n));
				};
				return u.dresolve(u.dict(_(objsById).map(function(obj,id) {
					obj.type = 'gannotation';
					obj.start =todate(obj[$scope.output.gannotate.startcol.newname]);
					obj.end = todate(obj[$scope.output.gannotate.endcol.newname]);
					obj.label = obj[$scope.output.gannotate.labelcol.newname];
					obj.source = $scope.output.gannotate.source;
					obj.category = $scope.output.gannotate.annotationtype;
					return [id,obj];
				})));
			}
		};

		var outputFilter = function(objsById) {
			if (filters[$scope.output.format]) {
				return filters[$scope.output.format](objsById);
			}
		};

		$scope.save = function() {
				try {
				var idCol = findIdColumn();
				var byId = {};
				var objIds = $scope.rows.map(function(row) {
					var id = row[idCol];
					byId[id] = remapColumns(row);
					return id;
				}), dd = u.deferred();

				var dosave = function() {
					var d = u.deferred();
					objIds = u.uniqstr(objIds).filter(function(x) { return x.trim().length > 0; });
					console.log("asking for ids ", objIds);
					box.getObj(objIds).then(function(models) {
						var ds = models.map(function(m) {
							if (byId[m.id]) {
								m.set(byId[m.id]);
								console.log('saving ', m.attributes);
								return m.save();
							}
						});
						u.when(ds).then(function() {
							u.safeApply($scope, function() {
								$scope.savedmodels = models;
								delete $scope.rows;
								delete $scope.cols;
								delete $scope.dropped;
							});
							d.resolve();
						}).fail(d.reject);
					}).fail(d.reject);
					return d.promise();
				};

				var filtered = outputFilter(byId);
				if (filtered) {
					filtered.then(function(byIdFiltered) {
						byId = byIdFiltered;
						objIds = _(byId).keys();
						dosave().then(dd.resolve).fail(dd.reject);
					}).fail(function() { console.error('error during filtering ', e); });
				} else {
					dosave().then(dd.resolve).fail(dd.reject);
				}
				return dd.promise();
			} catch(e) { $scope.err(e); console.error(e); }
		};

		$scope.clearIDExcept = function(c) {
			u.safeApply($scope, function() {
				$scope.cols.map(function(col) {
					if (c === col) return;
					col.id = false;
				});
			});
		};

		var parseCSV = function(csvstring) {
			var rows = d3.csv.parse(csvstring);
			setWait(false);
			u.safeApply($scope, function() {
				$scope.cols = _(rows[0]).keys().map(function(x) { return { name: x, newname: x }; });
				$scope.rows = rows.concat([]);
			});
		};

		var handleFileSelect = function(evt) {
			try {
				evt.stopPropagation();
				evt.preventDefault();
				u.safeApply($scope, function() { $scope.dropped = true; });
				setWait(true);
				$('.dropzone').removeClass('dragover');
				var files = evt.dataTransfer.files; // FileList object.
				window.files = files;
				for (var i = 0; i < files.length; i++) {
					var f = files[i], fr = new FileReader();
					fr.onload = function(e) { parseCSV(fr.result); };
					fr.readAsText(f);
					console.log('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
						f.size, ' bytes, last modified: ',
						f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
						'</li>');
				}
			} catch(e) { console.error(e); err(e); }
		};

		window.$s = $scope;
		window.setSaving = function(b) { u.safeApply($scope, function() { $scope.saving = b; }); };
		// Setup the dnd listeners.
		var dropZone = $('body')[0]; //  document.getElementById('dropzone');
		dropZone.addEventListener('dragover', handleDragOver, false);
		dropZone.addEventListener('dragleave', function() { console.log('drag leave!'); $('.dropzone').removeClass('dragover'); });
		dropZone.addEventListener('drop', handleFileSelect, false);
	});
