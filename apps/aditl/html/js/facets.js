/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, chrome, console, crossfilter, d3 */

// requires crossfilter

(function() {
	angular.module('aditl').directive('facets', function() {
		return {
			restrict:'E',
			scope:{ box:'=box'},
			templateUrl:'templates/facets.html',
			controller:function($scope, entities, utils) {
				var cf,
					values, 
					u = utils, 
					old_box,
					sa = function(f) { utils.safeApply($scope, f); }, 
					guid = u.guid(), 
					ordering,
					topOfDay = function(d) { 
					    var day = new Date(d.valueOf());
					    day.setHours(0); day.setMinutes(0); day.setSeconds(0); day.setMilliseconds(0); // midnight
					    return day;
					},
					today = topOfDay(new Date()),
					yesterday = topOfDay(new Date() - 24 * 60 * 60 * 1000),
					rawdate = function(vd) { return new Date(vd['@value']);  },
					dimensions = [
						{ name: 'url', f: function(d) { return d.url; }, type:'discrete' },
						{ name: 'domain', f : function(d) { return d.domain.trim(); }, type:'discrete', show:true },
						{ name: 'duration', f : function(d) { return d.tend.valueOf() - d.tstart.valueOf(); }, type:'discrete'},
						{ name: 'start', f : function(d) { return d.tend.valueOf(); }, type:'discrete'},
						{ name: 'title', f : function(d) { return d.title; }, type:'discrete'},
						{ name: 'end', f : function(d) { return d.tstart.valueOf(); }, type:'discrete'},
						{ name: 'date', f : function(d) { return topOfDay(d.tstart).valueOf().toString(); }, facetformat: function(val) {
							// val coming in will be a string
							var tod = topOfDay(new Date(+val));
							if (tod == today) { return 'Today'; }
							if (tod == yesterday) { return 'Yesterday'; }
							return d3.time.format('%a %d/%m')(tod);
						}, show: true},
						{ name: 'id', f : function(d) { return d.id; }, type:'discrete' }
					];

				$scope.dimensions = [];
				$scope.datetimeFormat = function(d) { 
					return d3.time.format('%d/%m/%y %H:%M:%S')(d);	
				};
				$scope.open_page = function(d) { window.open(d, '_blank'); };
				$scope.timeFormat = function(d) {
					return d3.time.format('%H:%M:%S')(d);	
				};
				$scope.format_mins = function(long) {
					return d3.format('2.2r')(long);
				};
				var deargs = function(url) { 
					var q = url.indexOf('?')>=0;
					if (q) { return url.slice(0,q); }
					return url;
				};
				$scope.strip = function(url) {
					if (url.indexOf('http://') === 0) { return url.slice(7); }
					if (url.indexOf('https://') === 0) { return url.slice(8); }
					return url;
				};

				var expand = function(activity) {
					var result = {
						tstart: activity.peek('tstart'),
						tend:activity.peek('tend'),
						url: activity.peek('what').id,
						domain : urlDomain(activity.peek('what').id),
						title : activity.peek('what').peek('title'),
						thumbnail: activity.peek('what').peek('thumbnail')
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
					if (cf && ordering) {
						var accesses = ordering.d.top(Infinity);
						var pages = {};
						accesses.map(function(d) { 
							var p = pages[d.url] || { 
								url: d.url,
								title: d.title,
								thumbnail: d.thumbnail,
								domain: d.domain,
								count: 0, 
								duration: 0
								// last_access: d.tstart.valueOf()
							};
							p.count++;
							p.duration += (d.tend - d.tstart);
							// p.last_access = Math.max(d.tstart.valueOf(), p.last_access);
							pages[d.url] = p;
						});
						var by_dur = _(pages).values();
						by_dur.sort(function(x,y) { return y.duration - x.duration; });
						sa(function() { $scope.main_values = by_dur; });
					}
				}, make_facet_vals = function(dim) { 
					var group = dim.g;
					var gg = group.top(Infinity).map(function(x) { return [x.key+'', x.value]; });
					return u.dict(gg);
				},
				update_facet_vals = function() { 
					sa(function() { 
						dimensions.map(function(dim) { 
							if (!dim.g) { return; }
							dim.g.top(Infinity).map(function(kv) { 
								var key = kv.key+'', val = kv.value;
								dim.facetvals[key] = val;
							});
						});
					});
				}, set_dim_filter = function(dim, value) { 
					console.log('setting dimension filter >> ', value);
					if (value) {
						dim.filter(value[0]);
					} else {
						dim.filter(null);
					}
					update_values();
					update_facet_vals();

				}, init_cf = function(data, dimdefs) { 
					values = data;
					cf = crossfilter(values);
					dimensions.map(function(dim) { 
						dim.d = cf.dimension(dim.f);
						if (dim.show) {
							dim.g = cf.dimension(dim.f).group();
							dim.facetvals = make_facet_vals(dim);
						}
					});
					// console.log('dimensions >>', dimensions);
					sa(function() { 
						set_ordering(dimensions.filter(function(x) { return x.name == 'start'; })[0]);
						$scope.dimensions = dimensions;
						u.range(dimensions.length).map(function(i) { 
							var dim_i = dimensions[i];
							console.log('setting watch ', 'dimensions['+i+'].selected');
							$scope.$watch('dimensions['+i+'].selected', 
								function() {
									console.log('watch fired >> ', i, dim_i.name, dim_i.selected);
									set_dim_filter(dim_i.d, dim_i.selected);
								});
						});
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
					box.on('obj-add', function(evtid) {
						if (evtid.indexOf('activity') === 0 && evtid.indexOf('browse') > 0) {
							box.getObj(evtid).then(function(evtm) {
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