/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, d3 */

angular.module('aditl')
	.directive('stackedgraph', function() { 
		return {
			restrict:'E',
			scope:{ width:'=', height:'=', stats:'' },
			replace:false,
			template:'<svg x-ng-attr-width="{{width}}" x-ng-attr-height="{{height}}"></svg>',
			controller:function($scope, $element, utils) {
				var u = utils, this_ = this;
				var svg = d3.select('svg');

				// just border
				var r = function(attrs) { 
					var rect = svg.append('rect');
					_(attrs).map(function(v,k) { 
						console.log(' setting attr ', k, ' - ', v);
						rect.attr(k,v); 
					});
					return rect;
				};
				r({ x: 0, y: 0, width:$scope.width, height: $scope.height, style: 'stroke:#eee;stroke-width:1px;fill:rgba(255,255,255,0.1);'});

				var translate = function(d, x, y) { return ['translate(', x, ',', y, ')'].join(); };

				// {  page1 : [ {instance1 val: val}, {instance2 val: val},  ],
				//    page2 : [ { ... } ]
				// }

				var margin = { top: 5, right: 5, left: 5, bottom: 5 };
				var width = $scope.width - margin.left - margin.right;
				var height = $scope.height - margin.top - margin.bottom;
				var x = d3.scale.ordinal().rangeRoundBands([0,width],0.1);
				var y = d3.scale.linear().rangeRound([height,0]);

				var update = function() { 
					var data = $scope.stats;
					var bars = svg.selectAll('g.bars')
						.data($scope.stats)
						.enter()
						.append('g')
						.attr('transform', function(d) { return translate(x(d.id),0); });

					bars.selectAll('rect.bar')
						.data(function(d) { return d.values; })
						.enter()
						.append('rect')
						.attr('class', 'bar')
						.attr("width", x.rangeBand())
						.attr("y", function(d) { });
				};

				// var rdata = svg.selectAll('rect.bops').data(rs);

				// rdata.enter()
				// 	.append('rect')
				// 	.attr('class', 'bops')
				// 	.attr('style', function(d) { return d.style; })
				// 	.attr('x', function(d) { return d.x; })
				// 	.attr('y', function(d) { return d.y; })
				// 	.attr('width', function(d) { return d.width; })
				// 	.attr('height', function(d) { return d.height; });

				// setInterval(function() { 
				// 	rs.map(function(r) { 
				// 		var rw = r.width; 
				// 		r.width = Math.max(1, Math.floor(rw + 10*Math.random() - 4));
				// 		var	rh = r.height; 
				// 		r.height = Math.max(1,Math.floor(rh + 10*Math.random() - 4));
				// 		rdata.attr('x', function(d) { return d.x; })
				// 			.attr('y', function(d) { return d.y; })
				// 			.attr('width', function(d) { return d.width; })
				// 			.attr('height', function(d) { return d.height; });
				// 	});
				// },1);
			}
		};
	}).factory('viewstats', function(client, utils, entities) {
		var u = utils;
		var TimeCounter = function(attrname) { 
			this.setGroupBy(attrname);
			this.clearStats();
		};
		TimeCounter.prototype = ({
			clearStats:function() { this.groups = {}; },
			setGroupBy:function(field) { 
				this.attr = field;
			},
			add:function(activity) { 
				u.assert(activity, "activity must not be undefined");
				u.assert(activity.peek('tend'), "activity tend must not be undefined");
				u.assert(activity.peek('tstart'), "activity tstart must not be undefined");
				var ttotal = activity.peek('tend') - activity.peek('tstart');
				var cat = activity.peek(this.attr);
				u.assert(cat, "category must not be undefined");
				this.groups[this.attr] = (this.groups[this.attr] || 0) + cat;
				return ttotal;
			},
			getCounts:function() {
				return _(this.groups).clone();
			}
		});
		return { TimeCounter: TimeCounter };
	}).controller('pgtest', function($scope) { 

	});
