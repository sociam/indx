/* globals: window */
/* jslint vars:true, todo:true, sloppy:true */

console.log('boo');
angular
	.module('example',['ui', 'indx'])
	.controller('App', function($scope, client) {
		$scope.selected_box = undefined;
		$scope.logged_in_user = undefined;
		
		var sa = window.sa = function(fn) { client.safe_apply($scope,fn); };
		_($scope).extend({ loading:0, inputmodel:'' });
		client.loaded.then(function() {
			console.log('indx loaded -- ');
			var store = client.store, model = new Backbone.Model(), box;
			console.log('indx store is ', store );
			// debug
			window._s = $scope;
			window.store = store;
			// -------
			u = client.utils;
			// i want to get a hold o
			// toolbar.on('login', function() { sa(function() { $scope.logged_in = true; }); });
			// toolbar.on('logout', function() { sa(function() { $scope.logged_in = false; }); });
			// toolbar.on('change:box', function(bid) {	load_box(bid) 	});
			$scope.$watch('selected_box', function() {
				console.log('selected box changed!! ', $scope.selected_box);
				load_box($scope.selected_box);
			});
			$scope.$watch('logged_in_user', function() {
				console.log('logged_in_user changed!! ', $scope.selected_user);
				$scope.logged_in = ($scope.selected_user !== undefined);
			});			
			var load_box = function(bid) {
				sa(function() {
					console.log('setting box_id ', bid); $scope.box_id = bid;
					delete $scope.inputmodel;
				});
				if (bid === undefined) {
					console.error('Box id is undefined');
					return;					
				}				
				store.get_box(bid).then(function(box) {
					box.get_obj('example1').then(function(o) {
						console.log('setting model ');
						model = o;
						$scope.update = function() {
							model.set({value: $scope.inputmodel}, {silent:true});
							try {
								console.log('input model is ', $scope.inputmodel, model.attributes.value);
								model.save();
							} catch(err) { console.error(err); }
						};
						// model -> scope
						var update_view = function() {
							var val = model.get('value') !== undefined ? model.get('value')[0] : '';
							console.log('update view val >> ', val);							
							if (val === $scope.inputmodel) { return; }
							sa(function() {
							 	$scope.inputmodel = val;
							 	console.log('setting inputmodel to ', $scope.inputmodel);
							});
						};
						model.on('change:value', update_view);
						update_view();
																		
					});
				}).fail(function(err) {
					sa(function() {
						$scope.error = 'error - ' + err;
						console.error(err);
					});
				});
			};
			if ($scope.selected_box) { load_box($scope.selected_box); }

		});			
	});

				
