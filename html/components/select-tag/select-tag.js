/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() {
	console.log('loading select-tag');
	angular
		.module('webbox-widgets')
		.directive('indxSelectVal', function() {
			return {
				restrict: 'E',
				templateUrl:'/components/select-tag/select-tag.html',
				controller:function($scope, $attrs, webbox) {
					console.log('controller');
					var store, u, $sa, model; // private, keep it out of the scope.

					$scope.model_id = $attrs.modelId;
					$scope.box_id = $attrs.boxId;
					$scope.property = $attrs.property;
					$scope.values = [];
					
					var ctx = { scope: $scope.model_id };

					$scope._reload = function() {
						console.log('reload >> '); // , $scope.model_id, $scope.box_id, $scope.property, $attrs );
						var reload = arguments.callee;
						if (store === undefined ||
							$scope.box_id === undefined ||
							$scope.model_id === undefined ||
							$scope.property === undefined) { return ; }
						store
							.get_box($scope.box_id)
							.fetch().then(function(box) {
								box.get_obj($scope.model_id)
									.then(function(_m) {
										console.log('loaded >> ' , _m.id);
										if (model) { model.off(null, null, ctx); }
										model = _m;
										window.model = model;
										model.on('change', function() { $sa(reload); }, ctx);
										$sa(function() {
											$scope.values = (model.get($scope.property) || []).concat();
											console.log('values are ', $scope.values, $scope.property, model.get($scope.property));
										});
									}).fail(function(err) {	u.error('box fetch error ', err);	});
							}).fail(function(err) {	u.error('select error ', err);	});
					};
					$scope.option_string = function(v) {
						// turns value
						if (_.isObject(v) && v instanceof webbox.Obj) {
							console.log('returning id ', v.id);
							return v.id;
						}						
						if (_.isString(v)) { return v; }
						return v.toString();						
					};
					$scope.option_value = function(v) {
						// turns value
						if (_.isObject(v) && v instanceof webbox.Obj) {
							console.log('returning id ', v.id);
							return v.id;
						}						
						if (_.isString(v)) { return v; }
						return v.toString();						
					};
					$scope.option_type = function(v) {
						// turns value
						if (_.isObject(v) && v instanceof webbox.Obj) { return 'resource'; }
						if (_.isObject(v) && v instanceof webbox.File) { return 'file'; }						
						if (_.isNumber(v)) { return 'number'; }
						if (_.isString(v)) { return 'string'; }
						return 'unknown';
					};					
					webbox.loaded.then(function(_s) {
						u = _s.u;
						store = _s.store;
						$sa = $scope.$sa = function(f) { _s.safe_apply($scope, f); };
						$sa($scope._reload);
					});					
				},
				link:function($scope, $element) {
					// add listeners here
					var $el = $element; // .select2({allowClear:true});
					$scope.$watch('box_id', $scope._reload);
					$scope.$watch('model_id', $scope._reload);
					$scope.$watch('property', $scope._reload);
					$el.on('change', function(evt) {
						var selected = $(evt.currentTarget).find(':selected');
						console.log('seleeeeeeeect!');

						u.when(selected.map(function(x) {
							var v = $(this).attr('value'),
								d = u.deferred(),
								t = $(this).attr('type');							
							if (t == 'resource') {	return box.get_obj(v);}
							if (t == 'string') {	d.resolve(v.toString()); }
							if (t == 'number') {	d.resolve(parseFloat(v)); }
							else { d.resolve(v); }
							return d.promise();
						}).get()).then(function(vals) {
							console.log('selected vals ', vals);
							window._scope = $scope;
							$scope.$sa(function() { $scope.selected = vals; });
						});
					});
					console.log('link done');
				} 
			}
		});
}());
