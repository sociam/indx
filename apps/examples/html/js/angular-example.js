/* globals: window */
/* jslint vars:true, todo:true, sloppy:true */   
 

function AppController($scope) {

	_($scope).extend({ loading:0, inputmodel:'' });

	WebBox.load().then(function() {
		var store = new WebBox.Store(), model = new Backbone.Model();		
		u = WebBox.utils;
		window.store = store;  /* TODO: debug */
		store.login(params.username,params.password).then(function() {
			var box = store.get_or_create_box(params.database);
			var next = function() {
				box.get_obj('example1').then(function(o) {
					model = o;
					var lastmodelval, lastinputval;

					
					$scope.$watch('inputmodel', function() {
						var val = $scope.inputmodel;

						// prevent our incoming modifications from causing us to trigger
						if (val === lastmodelval) {
							// console.log('viewchange :: skipping propagate ');
							return;
						}
						
						// silent updating
						if (model.get('value') !== undefined &&	val === model.get('value')[0]) {
							// console.log('value still the same');
							return;
						}						
						
						// console.log('view -> model. SAVING ', val);
						lastinputval = val;
						model.set('value', $scope.inputmodel);  // this is going to cause a trigger
						try { model.save(); } catch(err) { console.error(err); }
					});

					var update_view = function() {
						var val = model.get('value') !== undefined ? model.get('value')[0] : undefined;
						if (val === lastinputval) {
							// console.log('modelchange :: skipping propagate');
							return;
						}
						if (val === $scope.inputmodel) { return; }
						// console.log('model -> VIEW ', val);		
						lastmodelval = val;
						$scope.$apply(function() {	$scope.inputmodel = val;	});
					};
					model.on('change:value', update_view);
					update_view();
				});
			};
			box.fetch().then(next).fail(function(status) {
				// if it fails then might be that we haven't created the box yet
				u.debug('status >>>> ', status);
				box.save().then(next);
			});
			window.box = box; /* TODO: debug */
		});

	});
	
}
