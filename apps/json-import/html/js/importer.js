angular
	.module('importer', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var box, u = utils;
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

		$scope.save = function() {
				try {
				var idCol = findIdColumn();
				var byId = {};
				var objIds = $scope.rows.map(function(row) {
					var id = row[idCol];
					byId[id] = remapColumns(row);
					return id;
				});
				console.log(idCol, objIds);
				var d = u.deferred();
				objIds = u.uniqstr(objIds).filter(function(x) { return x.trim().length > 0; });
				console.log("asking for ids ", objIds);
				box.getObj(objIds).then(function(models) {
					var ds = models.map(function(m) {
						if (byId[m.id]) {
							m.set(byId[m.id]);
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
				});
			} catch(e) { $scope.err(e); console.error(e); }
			return d.promise();
		};

		$scope.clearIDExcept = function(c) {
			u.safeApply($scope, function() {
				$scope.cols.map(function(col) {
					if (c === col) return;
					col.id = false;
				});
			});
		};

		var flattenObj = function (_obj) {
			var obj = _.clone(_obj),
				referencedObjs = [];
			_.each(obj, function (v, k) {
				if (isObj(v)) {
					obj[k] = v['@id'];
					var o = flattenObj(v);
					referencedObjs.push(o.obj);
					referencedObjs = referencedObjs.concat(o.referencedObjs);
				}
				if (_.isArray(v)) {
					referencedObjs = referencedObjs.concat(flattenObjArray(v));
				}
			});
			return {
				obj: obj,
				referencedObjs: referencedObjs
			};
		}

		var isObj = function (o) {
			return _.isObject(o) && o.hasOwnProperty('@id');
		};

		var flattenObjArray = function (arr) {
			var objs = [];
			_.each(arr, function (obj, i) {
				if (isObj(obj)) {
					var o = flattenObj(obj);
					if (!o) { return; }
					objs.push(o.obj);
					objs = objs.concat(o.referencedObjs);
					arr[i] = '@' + obj['@id'];
				} else {
					//objs.push(obj);
				}
			});
			return objs;
		}

		var parseJSON = function(json) {
			var arr = JSON.parse(json);
			if (!(arr instanceof Array)) {
				arr = [];
			}
			var rows = flattenObjArray(arr);
			console.log(':)', rows)
			setWait(false);
			u.safeApply($scope, function() {
				var cols = $scope.cols = [];
				_.each(rows, function (obj) {
					_.each(obj, function (v, k) {
						if (_.where(cols, { name: k }).length === 0) {
							cols.push({ name: k, newname: k });
						}
					});
				});
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
					fr.onload = function(e) { parseJSON(fr.result); };
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
