/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $, d3 */


(function() {
	angular.module('vitality')
		.directive('weekchart', function() { 
			return {
				restrict:'E',
				template:'<div></div>',
				link:function($scope, $element) {
					var margin = {top: 20, right: 20, bottom: 30, left: 40},
							width = 460 - margin.left - margin.right,
							height = 300 - margin.top - margin.bottom;

					var x = d3.scale.ordinal()
							.rangeRoundBands([0, width], .1);

					var y = d3.scale.linear()
							.range([height, 0]);

					var xAxis = d3.svg.axis()
							.scale(x)
							.orient("bottom");

					var yAxis = d3.svg.axis()
							.scale(y)
							.orient("left")
							.ticks(10, "%");

					var svg = d3.select($element[0]).append("svg")
							.attr("width", width + margin.left + margin.right)
							.attr("height", height + margin.top + margin.bottom)
						.append("g")
							.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

					d3.tsv("fakedata/data.tsv", type, function(error, data) {
						x.domain(data.map(function(d) { return d.letter; }));
						y.domain([0, d3.max(data, function(d) { return d.frequency; })]);

						svg.append("g")
								.attr("class", "x axis")
								.attr("transform", "translate(0," + height + ")")
								.call(xAxis);

						svg.append("g")
								.attr("class", "y axis")
								.call(yAxis)
							.append("text")
								.attr("transform", "rotate(-90)")
								.attr("y", 6)
								.attr("dy", ".71em")
								.style("text-anchor", "end")
								.text("Frequency");

						svg.selectAll(".bar")
								.data(data)
							.enter().append("rect")
								.attr("class", "bar")
								.attr("x", function(d) { return x(d.letter); })
								.attr("width", x.rangeBand())
								.attr("y", function(d) { return y(d.frequency); })
								.attr("height", function(d) { return height - y(d.frequency); });

					});
					function type(d) {
						d.frequency = +d.frequency;
						return d;
					}
			} // link
		}; // return
	}).directive('bullets', function() { 
		return {
			restrict:'E',
			template:'<div><button class="update">Update</button></div>',
			link:function($scope, $element) {
				var margin = {top: 5, right: 40, bottom: 20, left: 120},
				    width = 460 - margin.left - margin.right,
				    height = 50 - margin.top - margin.bottom;

				var chart = d3.bullet()
				    .width(width)
				    .height(height);

				d3.json("fakedata/bullets.json", function(error, data) {
				  var svg = d3.select($element[0]).selectAll("svg")
				      .data(data)
				    .enter().append("svg")
				      .attr("class", "bullet")
				      .attr("width", width + margin.left + margin.right)
				      .attr("height", height + margin.top + margin.bottom)
				    .append("g")
				      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
				      .call(chart);

				  var title = svg.append("g")
				      .style("text-anchor", "end")
				      .attr("transform", "translate(-6," + height / 2 + ")");

				  title.append("text")
				      .attr("class", "title")
				      .text(function(d) { return d.title; });

				  title.append("text")
				      .attr("class", "subtitle")
				      .attr("dy", "1em")
				      .text(function(d) { return d.subtitle; });

				  d3.selectAll("button.update").on("click", function() {
				    svg.datum(randomize).call(chart.duration(1000)); // TODO automatic transition
				  });
				});

				function randomize(d) {
				  if (!d.randomizer) d.randomizer = randomizer(d);
				  d.ranges = d.ranges.map(d.randomizer);
				  d.markers = d.markers.map(d.randomizer);
				  d.measures = d.measures.map(d.randomizer);
				  return d;
				}

				function randomizer(d) {
				  var k = d3.max(d.ranges) * .2;
				  return function(d) {
				    return Math.max(0, d + k * (Math.random() - .5));
				  };
				}
			}
		};
	});	
})();