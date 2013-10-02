angular
	.module('importer', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
		$scope.output = {format:'output_raw'};
		$scope.cols = [];
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('getting box', $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
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

		var find_id_column = function() {
			var cols = $scope.cols;
			var selected = cols.filter(function(c) { return c.id; });
			if (selected.length > 0) { return selected[0].name; }
			selected = cols.filter(function(c) { return c.name.toLowerCase().trim() == 'id'; });
			if (selected.length > 0) { return selected[0].name; }
			return cols[0].name;
		};

		var remap_columns = function(src) {
			var out = {}, cols = $scope.cols;
			_(cols).map(function(c) { out[c.newname] = src[c.name];	});
			return out;
		};

		var set_wait = function(b) {
			u.safe_apply($scope, function() { $scope.wait = b;	});
		};

		$scope.do_save = function() {
			set_wait(true);
			return $scope.save().pipe(function (x) { set_wait(false); });
		};

		$scope.err = function(e) {
			u.safe_apply($scope, function() { $scope.error = e.toString(); });
		};

		var filters = {
			'output_gtime' : function(objs_by_id) {
				// get the time series, segment into offsets
				var objs = _(objs_by_id).values(),
					t = function(o) { return parseInt(o[$scope.output.gtime.timecol.newname]); },
					v = function(o) { return parseFloat(o[$scope.output.gtime.valcol.newname]); },
					channel = $scope.output.gtime.channel,
					source = $scope.output.gtime.source;

				objs.sort(function(o1, o2) { return t(o1) - t(o2); });
				var make_segment = function(start_obj, next_obj) {
					if (next_obj) {
						return { start : t(start_obj), channel: channel, source: source, values: [ v(start_obj), v(next_obj) ], delta : t(next_obj) - t(start_obj) };
					}
					return { start : t(start_obj), channel: channel, source: source, values: [ v(start_obj) ], delta: 0};
				};

				var segments = [];
				var update_last_segment = function(obj) {
					var segment = segments[segments.length-1];
					segment.values.push(v(obj));
				};
				var last_delta = function() { return segments[segments.length-1].delta;	};
				var last_time = function() { return segments[segments.length-1].start + ((segments[segments.length-1].values.length-1) * last_delta());	};

				if (objs.length > 0) {
					segment = make_segment(objs[0], objs.length > 1 ? objs[1] : undefined);
					segments.push(segment);
				}

				for (var i = 2; i < objs.length; i++) {
					// requires: at least 1 segment
					var obj = objs[i];
					console.log("i >> ", i, obj, t(obj), last_time(), segments[segments.length-1],  last_delta());

					if (t(obj) - last_time() !== last_delta()) {
						// uh oh difference, make new segemnt
						console.log('new segment! ', t(obj) - last_time(), last_delta());
						segments.push(make_segment(objs[i], objs[++i]));
					} else {
						update_last_segment(obj);
					}
				}
				return u.dict(segments.map(function(s) { return ["gtime-segment-" + s.channel + s.source + s.start, s]; }));
			},
			'output_gannotation': function(objs_by_id) {
				return u.dict(_(objs_by_id).map(function(obj,id) {
					obj.type = 'gannotation';
					obj.start = obj[$scope.output.gannotate.startcol];
					obj.end = obj[$scope.output.gannotate.endcol];
					obj.label = obj[$scope.output.gannotate.labelcol];
					obj.source = $scope.output.gannotate.scope;
					obj.category = $scope.output.gannotate.annotationtype;
					return [id,obj];
				}));
			}
		};

		var output_filter = function(objs_by_id) {
			if (filters[$scope.output.format]) {
				return filters[$scope.output.format](objs_by_id);
			}
		};

		$scope.save = function() {
				try {
				var id_col = find_id_column();
				var by_id = {};
				var obj_ids = $scope.rows.map(function(row) {
					var id = row[id_col];
					by_id[id] = remap_columns(row);
					return id;
				});

				var filtered = output_filter(by_id);
				if (filtered) { by_id = filtered; obj_ids = _(by_id).keys(); }

				var d = u.deferred();
				obj_ids = u.uniqstr(obj_ids).filter(function(x) { return x.trim().length > 0; });
				console.log("asking for ids ", obj_ids);
				box.get_obj(obj_ids).then(function(models) {
					var ds = models.map(function(m) {
						if (by_id[m.id]) {
							m.set(by_id[m.id]);
							console.log('saving ', m.attributes);
							return m.save();
						}
					});
					u.when(ds).then(function() {
						u.safe_apply($scope, function() {
							$scope.savedmodels = models;
							delete $scope.rows;
							delete $scope.cols;
							delete $scope.dropped; 
						});
						d.resolve();
					}).fail(d.reject);
				});
			} catch(e) { $scope.err(e); console.error(e); }
			return d.promise();
		};

		$scope.clearIDExcept = function(c) {
			u.safe_apply($scope, function() {
				$scope.cols.map(function(col) {
					if (c === col) return;
					col.id = false;
				});
			});
		};

		var parseCSV = function(csvstring) {
			var rows = d3.csv.parse(csvstring);
			set_wait(false);
			u.safe_apply($scope, function() {
				$scope.cols = _(rows[0]).keys().map(function(x) { return { name: x, newname: x }; });
				$scope.rows = rows.concat([]);
			});
		};

		var handleFileSelect = function(evt) {
			try {
				evt.stopPropagation();
				evt.preventDefault();
				u.safe_apply($scope, function() { $scope.dropped = true; });
				set_wait(true);
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
		window.setSaving = function(b) { u.safe_apply($scope, function() { $scope.saving = b; }); };
		// Setup the dnd listeners.
		var dropZone = $('body')[0]; //  document.getElementById('dropzone');
		dropZone.addEventListener('dragover', handleDragOver, false);
		dropZone.addEventListener('dragleave', function() { console.log('drag leave!'); $('.dropzone').removeClass('dragover'); });
		dropZone.addEventListener('drop', handleFileSelect, false);
	});
