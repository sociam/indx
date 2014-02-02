/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, d3 */

angular.module('aditl')
	.directive('pagesgraph', function() { 
		return {
			restrict:'E',
			scope:{ events:'=', width:'=', height:'=' },
			replace:false,
			template:'<svg x-ng-attr-width="{{width}}" x-ng-attr-height="{{height}}"></svg>',
			controller:function($scope, $element, utils) {
				var u = utils, this_ = this;
				var svg = d3.select('svg');
				// console.log('svg >> ', svg);
				var r = function(attrs) { 
					var rect = svg.append('rect');
					_(attrs).map(function(v,k) { 
						console.log(' setting attr ', k, ' - ', v);
						rect.attr(k,v); 
					});
					return rect;
				};
				window.r = r;
				r({ x: 0, y: 0, width:$scope.width, height: $scope.height, style: 'stroke:#eee;stroke-width:1px;fill:rgba(255,255,255,0.1);'})
				var rs = [
					r({ x: 10, y: 10, width: 50, height: 50, style: 'fill:yellow;stroke:1px solid blue'}),
					r({ x: 30, y: 20, width: 50, height: 10, style: 'fill:red;stroke:1px solid blue'}),
					r({ x: 60, y: 120, width: 20, height: 50, style: 'fill:red;stroke:1px solid orange; opacity:0.2;'})

				];
				setInterval(function() { 
					rs.map(function(r) { 
						var rw = parseInt(r.attr('width'));r.attr('width', '' + Math.max(1, Math.floor(rw + 10*Math.random() - 4)));
						var	rh = parseInt(r.attr('height'));r.attr('height', '' + Math.max(1,Math.floor(rh + 10*Math.random() - 4)));
					});
				},100);
			}
		};
	}).factory('viewstats', function(client, utils) {
		var StatCounter = function(attrname) { 
			this.setGroupBy(attrname);
		};
		StatCounter.prototype = ({
			clearStats:function() { },
			setGroupBy:function(field) { },
			add:function(activity) { },
			getCounts:function() {
				// 
			}
		});
		return { 
			StatCounter: StatCounter
		};
	}).controller('pgtest', function($scope) { 

	});
