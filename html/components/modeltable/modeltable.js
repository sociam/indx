/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() { 
	angular
		.module('webbox-widgets')
		.directive('modeltable', function() {
			return {
				restrict: 'E',
				scope:{},  // model:"=m" }, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/modeltable/modeltable.html',
				controller:function($scope, $attrs, webbox) {
					webbox.loaded.then(function() {
						// incoming : $scope.model <- inherited from parent scope via attribute m
						// $scope.uimodel <- gets set and manipulated by the ui
						// @attrs:
						//    box - box name
						//    parsechar - character to use to parse

						console.log("MODELTABLE box >> ", $scope.$parent.$eval($attrs.boxideval));
						console.log("MODELTABLE model >> ", $scope.$parent.$eval($attrs.modelideval));
						
						var modelid = $attrs.modelideval ? $scope.$parent.$eval($attrs.modelideval) : undefined;
						var u = webbox.u; // backbone model
						var parsechar = $attrs.parsechar || ',';
						var boxname = $attrs.box || ($attrs.boxideval && $scope.$parent.$eval($attrs.boxideval)), box;
						var resolve_fields = ['name', 'label', 'first_name'];
						var modeltoview = function(m) {
							// makes a ui model
							window.__model__ = m;
							if (m === undefined) { return {}; }				  
							return _(m.attributes).map(function(vs,k) {
								if (['@id'].indexOf(k) >= 0) { return; }
								var vals = vs.map(_serialise).filter(u.defined);
								console.log("vals >> ", vs, k, vals);
								return ({
									key: k,
									old_key: k,
									value: vals,
									old_val : vals
								});
							}).filter(u.defined);
						};				  
						var update_uimodel = function() {
							webbox.safe_apply($scope, function() { $scope.uimodel = modeltoview($scope.model); });
						};
						// model -> view
						var _serialise = function(v) {
							if (v instanceof WebBox.Obj || v instanceof WebBox.File) {  return v.name || v.id;	  }
							return v.toString();
						};								 
						// view -> model
						var parse = function(v) {
							// this tries to figure out what the user meant, including resolving
							// references to entities
							var d = u.deferred();
							if (!_.isNaN( parseFloat(v) )) { d.resolve(parseFloat(v)); }
							if (!_.isNaN( parseInt(v, 10) )) { d.resolve(parseInt(v, 10)); }
							if (box) {
								var stripstrv = v.toString().trim();
								if ( box.get_obj_ids().indexOf(stripstrv) >= 0 ) {
									box.get_obj(stripstrv).then(d.resolve).fail(d.reject);
								} else {
									// todo: get by names too
									var matches = box._objcache().filter(function(obj) {
										var fields = resolve_fields.map(function(f) { return obj.get(f); }).filter(u.defined).filter(function(x) { return x.length > 0; });
										return fields.indexOf(stripstrv) >= 0; 
									});
									if (matches.length > 0) { d.resolve(matches[0]); } else {  d.resolve(v);	  }
								}
							}
							return d.promise();
						};
						var _select2_val_out = function(v) { return v.text.trim(); };
						var parseview = function(viewobj, model) {
							// we need to take the textual representations out again
							var pdfd = u.deferred();

							// delete the changed keys
							viewobj.filter(function(x) { return x.old_key !== x.key; })
								.map(function(x) {
									model.unset(x.old_key);
									x.old_key = x.key; // update for next time!
								});					  
							// now parse out the val
							u.when(viewobj.map(function(propertyval) {
								var v = propertyval.value, k = propertyval.key;
								console.log("VALUE >> ", v);
								var d = u.deferred();
								// u.when(v.split(parsechar).map(parse)).then(function() {
								u.when(v.map(_select2_val_out).map(parse)).then(function() {
									model.set(k, _.toArray(arguments));
									d.resolve();
								}).fail(d.reject);
								return d.promise();
							})).then(function() { pdfd.resolve(model); }).fail(pdfd.reject);
							return pdfd.promise();
						};
						$scope.new_row = function() {
							console.log('new _ row ');
							var idx = _($scope.uimodel).keys().length + 1;
							var new_key = 'property '+idx;
							$scope.uimodel.push({ key: new_key, old_key: new_key, value:'', old_val: ''});
						};
						
						$scope.checkPropertyClass = function(propertyval) {
							var result = propertyval.key.length > 0 ? 'valid' : 'invalid';
							return result;
						};				  
						var find_invalid_uimodel_properties = function(uimodel) {
							return uimodel.filter(function(pv) { return $scope.checkPropertyClass(pv) === 'invalid'; });
						};
						$scope.commit_model = function() {
							var d = u.deferred();
							if ($scope.model !== undefined) {
								if (find_invalid_uimodel_properties($scope.uimodel).length === 0) {
									parseview($scope.uimodel, $scope.model).then(function(vals) {
										console.log('saving model >> ', $scope.model.attributes);
										$scope.model.save();
									}).fail(function(err) {
										u.error('error committing model ', err);
										d.reject(err);
									});
								} else {
									console.error('invalid properties ', find_invalid_uimodel_properties($scope.uimodel));
									d.reject();
								}
							}
							return d.promise();
						};
						$scope.delete_property = function(propertyval) {
							var model = $scope.model;
							var key = propertyval.key;
							console.log('unsetting ', key);
							model.unset(key);
							$scope.uimodel = _($scope.uimodel).without(propertyval);
							$scope.commit_model();
						};

						// initialise
						if (boxname) {
							box = webbox.store.get_or_create_box(boxname);
							box.fetch().then(function() {
								$scope.loaded = true;
								$scope.box_objs = box.get_obj_ids();
								if (modelid) {
									box.get_obj(modelid).then(function(model) {
										console.log(' ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ setting model', model);										
										$scope.model = model;										
										update_uimodel();										
									});
								} else {
									// already have the model can update directly
									update_uimodel();
								}
								$scope.$watch('model', update_uimodel);
							}).fail(function(err) { $scope.error = err; });
						}				  
					});
				}
			};
		});
}());
