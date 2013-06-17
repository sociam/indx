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
			var scope_bind = function($scope, name, model) {
				utils.assert(model instanceof Backbone.Model, "tried to bind something that was not a model");
				$scope[name] = model.attributes;
				var clone = _(model.attributes).clone();
				var changes = function(old,new_,fn) {
					var changes = [];
					_(old).map(function(v,k) {
						if (v[k] !== new_[k]) {
							changes.push(k);
							if (fn) { fn(k,v); }
						}
					});
					return changes;					
				};
				// angular -> backbone
				var dereg = $scope.watch(name, function() {
					// do a quick diff --
					// first check to make sure that our brave model is still 
					if ($scope[name] !== clone) { return; }
					var changes = compute_changes(clone, model.attributes, function(k,v) { model.set(k,v,{silent:true}); });
					changes.map(function(x) { model.trigger('change:'+x,model.attributes[x]); })
					if (changes) { model.trigger('change'); }
				});
				dregfns.push([$scope,name,model,dereg]);
				// backbone -> angular
				model.on('change', function() {
					webbox.safe_apply(function() {
						changes(model.attributes, clone, function(k,v) { clone[k] = v; });
					});
				},$scope);
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
