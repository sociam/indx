/* globals: window */
/* jslint vars:true, todo:true, sloppy:true */   
 
angular
	.module('example',['webbox'])
	.controller('App', function($scope, webbox) {
		var sa = window.sa = function(fn) { webbox.safe_apply($scope,fn); };
		_($scope).extend({ loading:0, inputmodel:'' });
		webbox.loaded.then(function() {
			console.log('loaded -- ');
			var store = webbox.store, model = new Backbone.Model(), box;
			console.log('webbox store is ', store );
			// debug
			window._s = $scope;
			window.store = store;
			// -------
			u = webbox.utils;
			webbox.toolbar.on('login', function() { sa(function() { $scope.logged_in = true; }); });
			webbox.toolbar.on('logout', function() { sa(function() { $scope.logged_in = false; }); });
			webbox.toolbar.on('change:box', function(bid) {
				load_box(bid)
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
				box = store.get_or_create_box(bid);
				box.fetch().then(function() {
					box.get_obj('example1').then(function(o) {
						console.log('setting model ');
						model = o;
						// scope -> model onchange
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
			sa(function() {	$scope.logged_in = store && store.toolbar && store.toolbar.is_logged_in(); });
			if (store.toolbar.is_logged_in() && store.toolbar.get_selected_box()) {
				load_box(store.toolbar.get_selected_box());
			}
		});
			
	});

				
