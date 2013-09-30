angular
	.module('importer', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
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

		if (window.File && window.FileReader && window.FileList && window.Blob) {

		} else {
			$scope.error = 'The File APIs are not fully supported in this browser.';
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

		$scope.save = function() {
				try { 
				var id_col = find_id_column();
				var by_id = {};
				var obj_ids = $scope.rows.map(function(row) {
					var id = row[id_col];
					by_id[id] = remap_columns(row);
					return id;
				});
				var d = u.deferred();
				obj_ids = u.uniqstr(obj_ids).filter(function(x) { return x.trim().length > 0; });
				console.log("asking for ids ", obj_ids);
				box.get_obj(obj_ids).then(function(models) {
					var ds = models.map(function(m) {
						if (by_id[m.id]) {
							m.set(by_id[m.id]);
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
