/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() { 
	angular
		.module('webbox-widgets')
		.directive('wordhistogram', function() {
			return {
				restrict: 'E',
				scope:{ counts:"=counts" }, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/text/word-histogram.html',
				controller:function($scope, $element, $attrs, webbox) {
					webbox.loaded.then(function() {
						// incoming : $scope.model <- inherited from parent scope via attribute m
						// $scope.uimodel <- gets set and manipulated by the ui
						// @attrs:
						//    box - box name
						//    parsechar - character to use to parse

						console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> histoload ");
						var u = webbox.u, c = d3.select($element[0]).select('svg');

						var render_update = function() {

							var counts = $scope.counts
							console.log('render update ! ', counts);

							u.assert( counts, "no counts model found, please specify the name of a $scope variable in counts= attr" );
							var margin = {top: $attrs.margin || 10, right: $attrs.margin || 30, bottom: $attrs.margin || 30, left: $attrs.margin || 30},
							   width = ($attrs.width || 1024) - margin.left - margin.right,
							   height = ($attrs.height || 768) - margin.top - margin.bottom;

							var n_bins = counts.keys().length,
								x = d3.scale.linear().domain([0, n_bins + 1]).range([0, width]),
								y = d3.scale.linear().domain([0, d3.max(counts.values())]).range([height, 0]);

							var xAxis = d3.svg.axis().scale(x).orient("bottom");
							var svg = c.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
							var data = counts.keys().map(function(k) {	return { key : k , value : counts.get(k)[0] || 0 };	});
							data.sort(function(x,y) { return y.value - x.value; }); // descending

							_(data).map(function(v,i) { v.rank = i; });
							data = data.slice(0,100);

							console.log("COUNTS >> ", data.map(function(x) { return x.value; }));

							var bar_width = 1/(n_bins+1) - (0.10/(n_bins+1)); // bar spacing
							
							var bar = svg.selectAll(".bar")
								.data(data, function(x) { return x.key; })
								.enter().append("g")
								.attr("class", "bar")
								.attr("transform", function(d) { return "translate(" + x(d.rank) + "," + y(d.value) + ")"; });
							
							bar.append("rect")
								.attr("x", 1)
								.attr("width", bar_width)
								.attr('fill', '#aef')
								.attr("height", function(d) { return y(d.value); });

							bar.append("text")
								.attr("dy", ".75em")
								.attr("y", 6)
								.attr("x", bar_width/2)
								.attr("text-anchor", "middle")
								.attr('fill', 'white')
								.text(function(d) { return d.key; });

							svg.append("g")
								.attr("class", "xaxis")
								.attr("transform", "translate(0," + height + ")")
								.call(xAxis);
						};
						$scope.$watch('counts', function() {
							if ($scope.counts) {
								$scope.counts.on('update-counts', render_update);
							} else {
								console.error("warning: counts is undefined");
							}
						});									
					});


				}
			};
		});
}());
