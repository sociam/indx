/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() { 
	angular
		.module('webbox-widgets')
		.directive('modeltable', function() {
			return {
				restrict: 'E',
				scope:{model:"=model", box:"=box"}, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/modeltable/modeltable.html',
				controller:function($scope, $attrs, webbox) {
					
					webbox.loaded.then(function() {
						// incoming : $scope.model <- inherited from parent scope via attribute m
						// $scope.uimodel <- gets set and manipulated by the ui
						// @attrs:
						//    box - box name
						//    parsechar - character to use to parse

						var box;													

						// console.log('scope model ', $scope.model, ' scope box ', $scope.box);
						// console.log("MODELTABLE box >> ", $attrs.boxideval, $scope.$parent.$eval($attrs.boxideval), $scope.$eval($attrs.boxideval));
						// console.log("MODELTABLE model >> ", $attrs.modelideval, $scope.$parent.$eval($attrs.modelideval), $scope.$eval($attrs.modelideval));

						window._s = $scope;
						var u = webbox.u; // backbone model
						var parsechar = $attrs.parsechar || ',';
						var resolve_fields = ['name', 'label', 'first_name'];
						var make_uiobj = function(key,val) {
							return { key: key, old_key: key, value: val, old_val : val };
						};
						var modeltoview = function() {
							// makes a ui model
							var m = $scope.model;
							if (m === undefined) { return []; }
							if (m === undefined) {
								console.log(" m is undefined ? ", m);
								return [];
							}
							var result = _(m.attributes).map(function(vs,k) {
								if (['@id'].indexOf(k) >= 0) { return; }
								var vals = vs.map(_serialise).filter(u.defined);
								console.log('vals >> ', vs, ' -> ', vals);
								return vals.length ? make_uiobj(k,vals) : undefined;
							}).filter(u.defined);
							console.log('modeltoview result > ', JSON.stringify(result));
							return result;
						};
						
						$scope._update_in_place = function() {
							var newmodel = $scope.model;
							var new_keys = newmodel.omit(['@id', '@type'].concat(_($scope.uimodel).map(function(x) { return x.key; })));

							console.log('update in place >> ', new_keys);
							// console.log("ui model >> ", newmodel.keys(), newmodel.keys().length, $scope.uimodel.length,_(new_keys).keys().length, new_keys);
							var new_ui_objs = _(new_keys).map(function(v,k) {
								console.log('new_ui_objs >> calling make_uiobj ', k, v, make_uiobj(k,v));
								return make_uiobj(k,v);
							});
							var dead_ui_objs = _($scope.uimodel).map(function(uio) { if (newmodel.keys().indexOf(uio.key) < 0) { return uio; }	}).filter(u.defined);
							console.log('deadkeys >> ', dead_ui_objs);							
							var new_uimodel = _($scope.uimodel).difference(dead_ui_objs).map(function(uio) {
								console.log('updating keys ', uio.key, newmodel.get(uio.key));
								var old_values = uio.value.map(function(x) { return x.text; });
								// console.log('old values ', old_values);
								// update objects in place
								var uik = uio.key, mvs = newmodel.get(uik).map(_serialise);
								var newvs = _(mvs)
									.difference(uio.value.map(function(x) { return x.text; }))
									.map(function(x) { return { id: x, text: x }; });
								var remainingvs = uio.value.filter(function(x) { return mvs.indexOf(x.text) >= 0;});
								if (remainingvs.length === old_values.length && newvs.length === 0) {
									// console.log(uik, 'skipping since no updates ');
									return uio;
								} else {
									// console.log('mvs >> ', mvs, remainingvs, ' new value ', _(remainingvs).concat(newvs));
									uio.value = _(remainingvs).concat(newvs);
									// console.log('new uio.value ', uio.value);
								}
								return uio;
							}).concat(new_ui_objs);
							console.log("NEW SCOPE UIMODEL IS ", new_uimodel);
							$scope.uimodel = new_uimodel;							
						};
						$scope.update_uimodel = function() {
							// should be run in a safe apply
							if ($scope.model === undefined) { return console.warn('$scope.model is undefined'); }
							if ($scope.uimodel === undefined) {
								var m2v = modeltoview();
								$scope.uimodel = m2v; 
								console.log('ran standalone modeltoview ', m2v);
							} else {
								$scope._update_in_place();
								console.log('ran updateinplace ', m2v);								
							}
						};
						// model -> view
						var _serialise = function(v) {
							if (v instanceof WebBox.Obj || v instanceof WebBox.File) {
								sv = v.name || v.id;
							} else {
								sv = v.toString();
							}
							console.log('serialising ', v, sv)
							return sv; 
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
									if (matches.length > 0) {
										d.resolve(matches[0]);
									} else {
										d.resolve(v);
									}
								}
							}
							return d.promise();
						};
						var _select2_val_out = function(v) { if (v.text) { return v.text.trim(); } };
						var parseview = function() {
							var viewobj = $scope.uimodel, model = $scope.model;
							var pdfd = u.deferred();
							// delete the changed keys
							viewobj
								.filter(function(x) {
									return x.old_key !== x.key;
								}).map(function(x) {
									model.unset(x.old_key);
									x.old_key = x.key; // update for next time!
								});
							// now parse out the val
							u.when(viewobj.map(function(propertyval) {
								var v = propertyval.value, k = propertyval.key;
								var d = u.deferred();
								var parsed_and_resolved = v.map(_select2_val_out).filter(u.defined).map(parse);
								u.when(parsed_and_resolved).then(function() {
									d.resolve([k,_.toArray(arguments)]);
								}).fail(d.reject);
								return d.promise();
							})).then(function() { pdfd.resolve(u.dict(_.toArray(arguments))); }).fail(pdfd.reject);
							return pdfd.promise();
						};
						$scope.new_row = function() {
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
									console.log('calling parseview >> ', $scope.uimodel);
									setTimeout(function() {
										parseview().then(function(value_obj) {
											$scope.model.set(value_obj);
											// $scope.model.save();
										}).fail(function(err) {
											u.error('error committing model ', err);
											d.reject(err);
										});
									}, 1);
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
							setTimeout(function() { model.unset(key); $scope.commit_model(); });
						};
						/*
						var _init_ = function() {
							// initialise
							var modelid = $scope.model ? $scope.model.id : ($attrs.modelid || ($attrs.modelideval && $scope.$parent.$eval($attrs.modelideval)));
							var boxid = $scope.box ? $scope.box.id : ($attrs.box || ($attrs.boxideval && $scope.$parent.$eval($attrs.boxideval)));
							console.log("calling _init_", modelid, boxid);								
							if (boxid) {
								// set box, which is used above ^
								box = webbox.store.get_or_create_box(boxid);
								box.fetch().then(function() {
									$scope.loaded = true;
									$scope.box_objs = box.get_obj_ids();
									if (modelid) {
										console.log(' getting  modelid ', modelid);									
										box.get_obj(modelid).then(function(model) {
											// console.log(' ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ setting model',model, _(model.attributes).keys().length);
											console.log('got model >> ', modelid, model);
											$scope.model = model;
											$scope.model.on('change', function() {
												console.log('TABLE ------------- MODEL CHANGE >> ', $scope.model.id);
												webbox.safe_apply($scope,$scope.update_uimodel);
											});
											webbox.safe_apply($scope, $scope.update_uimodel);
										});
									} else {
										// already have the model can update directly
										console.log('already have the model can update directly ');
										$scope.$apply($scope.update_uimodel);
										$scope.$watch('model', $scope.update_uimodel);
									}

								}).fail(function(err) { $scope.error = err; });
							}
						};
						*/

						var context = { id : Math.random() };
						var old_model, old_box;
						var listen_and_update = function() {
							box = $scope.box;
							$scope.box_objs = box ? box.get_obj_ids() : [];
							var model = $scope.model;
							if (old_model) {
								old_model.off(null, null, context);
							}
							if (model) {
								model.on('change', function() {
									$scope.$apply($scope.update_uimodel);
								}, context);
								$scope.update_uimodel();
							}
							old_model = model;
						};					
						$scope.$watch('model', listen_and_update);
						$scope.$watch('box', listen_and_update);
						$scope.$apply(listen_and_update);						
					});
				}
			};
		});
}());
