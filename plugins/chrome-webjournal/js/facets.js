/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, chrome, console, crossfilter, d3 */

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
					values, 
					u = utils, 
					old_box,
					sa = function(f) { utils.safeApply($scope, f); }, 
					guid = u.guid(), 
					ordering,
					rawdate = function(vd) { return new Date(vd['@value']);  },
					dimensions = [
						{ name: 'url', f: function(d) { return d.url; }, type:'discrete'},
						{ name: 'domain', f : function(d) { return d.domain; }, type:'discrete' },
						{ name: 'duration', f : function(d) { return d.tend.valueOf() - d.tstart.valueOf(); }, type:'discrete'},
						{ name: 'start', f : function(d) { return d.tend.valueOf(); }, type:'discrete'},
						{ name: 'end', f : function(d) { return d.tstart.valueOf(); }, type:'discrete'},
						{ name: 'id', f : function(d) { return d.id; }, type:'discrete'}
					];

				$scope.dimensions = [];
				$scope.dateFormat = function(d) { 
					console.log('d is >> ', d);
					return d3.time.format('%H:%M:%S')(d);	
				};

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
				}, set_dimension_filter = function(dimension, value) { 
					dimension.d.filter(value ? value : null);
					update_values();
				}, set_ordering = function(dimension) { 
					ordering = dimension;
				}, update_values = function() { 
					sa(function() {
						if (cf) { 
							sa(function() { 
								$scope.filtered_values = ordering.d.top(Infinity);	
							});
						}
					});
				}, init_cf = function(data, dimdefs) { 
					values = data;
					cf = crossfilter(values);
					dimensions.map(function(dim) { 
						dim.d = cf.dimension(dim.f);	
						dim.g = dim.d.group().all();
						console.log(dim.g);
						console.log(dim.g.map(function(x) { return x.key; }));
						dim.values = dim.g.map(function(x) { return x.key; });
					});
					console.log('dimensions >>', dimensions);
					sa(function() { 
						set_ordering(dimensions.filter(function(x) { return x.name == 'start'; })[0]);
						$scope.dimensions = dimensions;	
					});
					update_values();
				}, load_box = function(box) {
					console.log('load >>', box);					
					entities.activities.getByActivityType(box,undefined,undefined,'browse').then(function(events){
						console.info('facet ::: load browse >> ', events.length);
						var expanded = events.map(expand).filter(u.defined);
						init_cf(expanded);
					});
				};
				
				var set_box = function(box) { 
					console.info('set box >> ', box);
					cf = undefined;
					if (old_box) { old_box.off(undefined, undefined, guid); }
					$scope.dimensions = [];
					box.on('obj-add', function(evt) {
						if (evt.id.indexOf('activity') === 0 && evt.id.indexOf('browse') > 0) {
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
					console.info('facet ::: watch box >> ', box);
					if ($scope.box) { 
						set_box($scope.box);
					}
				});
				window.$f = $scope;
			}};
		});
}());