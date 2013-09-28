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
		};

		var find_id_column = function() {
			var cols = $scope.cols;
			return cols.filter(function(c) { return c.id; })[0].name;
		};

		var remap_columns = function(src) {
			var out = {}, cols = $scope.cols;
			_(cols).map(function(c) { out[c.newname] = src[c.name];	});
			return out;
		};

		$scope.do_save = function() {
			u.safe_apply($scope, function() { 
				$scope.saving = true;
			});
			$scope.save().then(function () {
				u.safe_apply($scope, function() { delete $scope.saving; });
			});
		};

		$scope.save = function() {
			var id_col = find_id_column();
			console.log('id column, ', id_col);
			var by_id = {};
			var obj_ids = $scope.rows.map(function(row) {
				var id = row[id_col];
				by_id[id] = remap_columns(row);
				return id;
			});
			var d = u.deferred();
			console.log('saving objects >> ', obj_ids);
			box.get_obj(obj_ids).then(function(models) {
				var ds = models.map(function(m) {
					if (by_id[m.id]) {
						m.set(by_id[m.id]);
						return m.save();
					}
				});
				u.when(ds).then(d.resolve).fail(d.reject);
			});
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
			u.safe_apply($scope, function() {
				$scope.cols = _(rows[0]).keys().map(function(x) { return { name: x, newname: x }; });
				$scope.rows = rows.concat([]);
			});
		};

		var handleFileSelect = function(evt) {
			evt.stopPropagation();
			evt.preventDefault();
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
		};

		// Setup the dnd listeners.
		var dropZone = $('body')[0]; //  document.getElementById('dropzone');
		dropZone.addEventListener('dragover', handleDragOver, false);
		dropZone.addEventListener('drop', handleFileSelect, false);
	});
