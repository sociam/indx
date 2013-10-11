(function() {
	angular
		.module('indx')
		.directive('wordhistogram', function() {
			return {
				restrict: 'E',
				scope:{ counts:"=counts" }, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/text/word-histogram.html',
				controller:function($scope, $element, $attrs, client, utils) {
					// incoming : $scope.model <- inherited from parent scope via attribute m
					// $scope.uimodel <- gets set and manipulated by the ui
					// @attrs:
					//    box - box name
					//    parsechar - character to use to parse
					
					// console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> histoload ");
					var u = utils, c = d3.select($element[0]).select('svg');

					var render_update = function() {
						var counts = $scope.counts; console.log('render update ! ', counts);
						u.assert( counts, "no counts model found, please specify the name of a $scope variable in counts= attr" );

						var margin = {top: $attrs.margin || 10, right: $attrs.margin || 30, bottom: $attrs.margin || 30, left: $attrs.margin || 30},
							width = ($attrs.width || 1024) - margin.left - margin.right,
							height = ($attrs.height || 768) - margin.top - margin.bottom;

						var n_bins = Math.min(100,counts.keys().length);

						var bar_width = width/(n_bins+1); // bar spacing
						// console.log("bar width : ", bar_width);
						
						var svg = c.selectAll('.wordhist').data([0]);
						svg.enter().append("g")
							.attr('class','wordhist')
							.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
						
						var data = counts.keys().filter(function(x) { 
							return x !== '@id';
						}).map(function(k) {	return { key : k , value : counts.get(k)[0] || 0 };	});
						data.sort(function(x,y) { return y.value - x.value; }); // descending
						_(data).map(function(v,i) { v.rank = i; });
						data = data.slice(0,n_bins);
						console.log('data >> ', data);
						
						var x = d3.scale.linear().domain([0, n_bins + 1]).range([0, width]),
						y = d3.scale.linear()
							.domain([0, d3.max(data.map(function(x) { return x.value; }))])
							.range([0,height]);
						
						var xAxis = d3.svg.axis().scale(x).orient("bottom");

						// console.log("COUNTS >> ", data, data.map(function(x) { return x.rank; })); // data.map(function(x) { return x.value; }));
						console.log('counts -- ', data.length, data.map(function(x) { return x.key; }));
						
						var bars = svg.selectAll(".bar").data(data);
						bars.enter().append("g");
						bars.attr("class", "bar")
							.attr('key', function(x) { return x.key; })
							.transition()
							.attr("transform", function(d) {
								// console.log('translating', d.key, ' ', d.rank, ' ', x(d.rank), "translate(" + x(d.rank) + "," + (height-y(d.value)) + ")");
								return "translate(" + x(d.rank) + "," + (height-y(d.value)) + ")";
							})
							.each(function(d) {
								d3.select(this).selectAll('rect').data([0]).enter().append('rect');
								d3.select(this).selectAll('rect')
									.transition()
									.attr("x", 1)
									.attr("width", bar_width)
									.attr('fill', '#aef')
									.attr("height", function() { return y(d.value); });
							
								d3.select(this).selectAll('.label').data([0]).enter().append('text').attr('class', 'label');
								d3.select(this).selectAll('.label')
									.transition()
									.attr("y", -(bar_width/2)+3+"px")//-bar_width/4) // 6)
									.attr('font-size', '10px')
									.attr('transform','rotate(90)')
									.attr("x", 5) // bar_width/2)
									.attr("text-anchor", "left")
									.attr('fill', 'white')
									.text(function() { return d.key; });
								});
						bars.exit().remove();

						var xaxis = svg.select('.xaxis').data([0]);
						xaxis.enter().append("g")
							.attr("class", "xaxis")
							.attr("transform", "translate(0," + height + ")")
							.call(xAxis);
						xaxis.exit().remove();
					};
					$scope.$watch('counts', function() {
						if ($scope.counts) {
							$scope.counts.on('update-counts', render_update);
						} else {
							console.error("warning: counts is undefined");
						}
					});
			}};
		});
})();