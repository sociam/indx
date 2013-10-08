/* globals: window */
/* jslint vars:true, todo:true, sloppy:true */

console.log('boo');
angular
	.module('example',['ui', 'indx'])
	.controller('App', function($scope, client) {
		var model, 
			sa = window.sa = function(fn) { client.safe_apply($scope,fn); };

		_($scope).extend({ 
			loading:0, 
			inputmodel:{}, 
			toolbar:{}
		});

		client.loaded.then(function() {
			console.log('indx loaded -- ');
			var store = client.store, model = new Backbone.Model(), box;
			console.log('indx store is ', store );
			// debug
			window.s = $scope;
			window.store = store;
			// -------
			u = client.utils;
			// i want to get a hold o
			// toolbar.on('login', function() { sa(function() { $scope.logged_in = true; }); });
			// toolbar.on('logout', function() { sa(function() { $scope.logged_in = false; }); });
			// toolbar.on('change:box', function(bid) {	load_box(bid) 	});
			$scope.$watch('toolbar.selected_box + toolbar.selected_user', function() {
				console.log('selected box changed!! ', $scope.toolbar.selected_box);
				if ($scope.toolbar.selected_box) { load_box($scope.toolbar.selected_box); }
			});
			// v2m
			$scope.v2m = function() {
				// view -> model
				if (!model) { console.error('model is undefined'); return; }
				console.log('saving >> ', $scope.inputmodel.value);
				model.set({value: $scope.inputmodel.value}, {silent:true});
				try { model.save();	} catch(err) { console.error(err); }
			};
			var m2v_update = function() {
				if (!model) { console.error(' model is undefined'); return; }
				var val = model.get('value') !== undefined ? model.get('value')[0] : '';
				console.log('update view val >> ', val);
				if (val !== $scope.inputmodel.value) { 
					sa(function() {
						$scope.inputmodel.value = val;
						console.log('setting inputmodel to ', $scope.inputmodel.value);
					});
				}
			};
			var load_box = function(bid) {
				sa(function() {
					console.log('setting box_id ', bid);
					$scope.box_id = bid;
					delete $scope.inputmodel.value;
				});
				if (bid === undefined) {console.error('Box id is undefined'); return;	}				
				store.get_box(bid).then(function(box) {
					console.log(' box >> ', box);
					window.box = box;
					console.log('getting object example --- ');
					box.get_obj('example1').then(function(o) {
						console.log('object example --- ', o);

						window.model = o;
						model = o;
						// model -> scope
						model.on('change:value', m2v_update);
						m2v_update();																		
					});
				}).fail(function(err) {
					sa(function() {
						$scope.error = 'error - ' + err;
						console.error(err);
					});
				});
			};

			if ($scope.toolbar.selected_box) { load_box($scope.toolbar.selected_box); 	}
			window.load_box = load_box;
		});			
	});

				
