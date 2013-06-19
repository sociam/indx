(function() {
	angular
		.module('webbox', ['ui'])
		.factory('webbox',function() {
			var exports = {};
			var d = exports.loaded = new $.Deferred();
			exports.safe_apply = function($scope, fn) {
				setTimeout(function() { $scope.$apply(fn); }, 0);
			};
			WebBox.load().then(function() {
				exports.u = window.u = WebBox.utils;
				exports.store = window.store = new WebBox.Store();
				exports.Obj = WebBox.Obj;
				exports.File = WebBox.File;
				exports.Box = WebBox.Box;
				exports.Store = WebBox.Store;												
				exports.store.fetch()
					.then(function() { d.resolve(exports); })
					.fail(function() {
						// TODO
						u.error('Warning: error fetching boxes - probably not logged in! thats ok');
						d.resolve(exports);
					});
				exports.toolbar = exports.store.toolbar;
			});
			return exports;
		}).factory('backbone', function(webbox, utils) {
			// this manages backbone-angular mystification
			var deregfns = [];
			var deep_clone_obj = function(o) {
				return utils.dict(_(o).map(function(v,k) { return [k, v.concat()]; }));
			};
			var scope_bind = function($scope, name, model) {
				utils.assert(model instanceof Backbone.Model, "tried to bind something that was not a model");
				window._m = model;
				var clone = deep_clone_obj(_(model.attributes));
				webbox.safe_apply($scope, function() { $scope[name] = clone;	});
				var findchanges = function(old,new_,fn) {
					var changes = [];
					_(old).map(function(v,k) {
						if (v.length !== new_[k].length || _(v).filter(function(vi, i) { return vi != new_[k][i]; }).length) {
							console.log('pushing changes ', k, new_[k]);
							changes.push(k);
							if (fn) { fn(k,new_[k].concat()); }
						}
					});
					return changes;					
				};
				// angular -> backbone
				console.log('watching ', name);
				var dereg = $scope.$watch(name, function() {
					// do a quick diff --
					// first check to make sure that our brave model is still
					if ($scope[name] !== clone) { console.log('returning ' ); return true; }
					console.log('findchanges ', clone.value[0], model.attributes.value[0], clone === model.attributes);
					var changes = findchanges(model.attributes, clone, function(k,v) {
						model.set(k,v);
						console.log('saving model >  ', JSON.stringify(model.attributes));
						model.save();
					});
					/*
					console.log('changes found > ', changes.length);
					if (changes.length) {
						model.trigger('change'); 
						changes.map(function(x) { model.trigger('change:'+x,model.attributes[x]); })
					}
					*/
				}, true);
				deregfns.push([$scope,name,model,dereg]);
				// backbone -> angular
				model.on('change', function(data) {
					console.log('change! ', JSON.stringify(model.attributes));
					webbox.safe_apply($scope, function() {
						findchanges(clone, model.attributes, function(k,v) {
							console.log('model -> angular ', k, v);
							clone[k] = v;
						});
					});
				},$scope);
				console.log('scope binding ', $scope.$id, name, "<-", model.get('value'));				
			};
			return {
				scope_bind: scope_bind,
				scope_unbind:function($scope,name) {
					deregfns.map(function(tuple) {
						var scope = tuple[0],name = tuple[1],model = tuple[2],dereg = tuple[3];
						model.off('change', null, scope);
						dereg();
					});
				}
			};
		});
}());
