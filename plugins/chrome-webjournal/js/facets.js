/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, chrome, console, crossfilter */

// requires crossfilter

(function() {
	angular.module('webjournal')
	.directive('facets', function() {
		return {
			restrict:'E',
			scope:{ box:'=box'},
			templateUrl:'/facets.html',
			controller:function($scope, entities, utils) {
				var cf,
					u = utils, 
					old_box,
					sa = function(f) { utils.safeApply($scope, f); }, 
					guid = u.guid(), 
					rawdate = function(vd) { return new Date(vd['@value']);  },
					dimensions = [
						{ name: 'url', f: function(d) { return d.url; }},
						{ name: 'domain', f : function(d) { return d.domain; } },
						{ name: 'duration', f : function(d) { return d.tend.valueOf() - d.tstart.valueOf(); }},
						{ name: 'start', f : function(d) { return d.tend.valueOf(); }},
						{ name: 'end', f : function(d) { return d.tstart.valueOf(); }},
						{ name: 'id', f : function(d) { return d.id; }}
					];					

				$scope.dimensions = [];

				var expand = function(activity) {
					var result = {
						tstart: activity.peek('tstart'),
						tend:activity.peek('tend'),
						url: activity.peek('what').id,
						domain : urlDomain(activity.peek('what').id)
					};
					if (result.tstart && result.tend && result.url && result.domain) {
						return result;
					}
					// return undefined;
				}, urlDomain = function(d) { 
					var url = new URL(d),
						host = url.hostname,
						trailing = host.split('.').slice(-2).join('.');
					return trailing;
				}, add_event = function(evtm) { 
					var expm = expand(evtm);
					if (cf) { cf.add(expm); }
				}, update_values = function() { 
					sa(function() {
						if (cf) { 
							$scope.values = cf.filter(null);
						}
						// $scope.filtered_values = compute_filter(cf,$scope.dimensions);
					});
				}, init_cf = function(data, dimdefs) { 
					cf = crossfilter(data);
					dimensions.map(function(dim) { 
						dim.d = cf.dimension(dim.f);	
						if (['url','domain'].indexOf(dim.name)) {
							dim.g = dim.d.group();
						}
					});
					sa(function() { $scope.dimensions = dimensions;	});
				}, load_box = function(box) {
					entities.getByActivityType(box,undefined,undefined,'browse').then(function(events){
						console.log('loading events >. ', events.length);
						events.map(expand).filter(u.defined).then(function(expanded) {
							$scope.values = expanded;
							init_cf(expanded);
						});
					});
				};
				
				var set_box = function(box) { 
					console.log('got a box >>>> ', box);
					cf = undefined;
					if (old_box) { old_box.off(undefined, undefined, guid); }
					$scope.dimensions = [];
					box.on('obj-add', function(evt) {
						if (evt.id.indexOf('activity') == 0 && evt.id.indexOf('browse') >= 0) {
							box.getObj(evt).then(function(evtm) {
								add_event(evtm);
								update_values();
							});
						}
					}, guid);
					old_box = box;
					load_box(box);
				};

				$scope.$watch('box', function(box) {
					if ($scope.box) { set_box($scope.box);}
				});
			}};
		});
}());