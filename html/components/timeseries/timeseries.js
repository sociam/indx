/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true todo:true sloppy:true */

(function() {
	angular
		.module('webbox-widgets')
		.directive('timeseries', function() {
			return {
				restrict: 'E',
				scope:{model:"=model", box:"=box", property:"=property"}, // these means the attribute 'm' has the name of the scope variable to use
				templateUrl:'/components/timeseries/timeseries.html',
				controller:function($scope, $element, $attrs, webbox) {
					// incoming :
					//   $scope.model <- model 
					//   $scope.box <- from property
					//   $attr.propert[ies] <- properties to plot
					console.log("TIMESERIES INIT >>>>>> ");
   
                    var update_chart = function($element, data){
                        try {
                            var new_node = $($element).find(".timeseries-chart"); // find the chart within this scope's element
                            new_node.html(""); // remove existing chart
                            new_node = new_node[0]; // get DOM node
                            console.debug("new_node", new_node);

                            var width = 750;
                            var height = 150;

                            var margin = {top: 20, right: 20, bottom: 30, left: 50},
                                width = width - margin.left - margin.right,
                                height = height - margin.top - margin.bottom;

                            //var parseDate = d3.time.format("%d-%b-%y").parse;

                            var x = d3.time.scale()
                                .range([0, width]);

                            var y = d3.scale.linear()
                                .range([height, 0]);

                            var xAxis = d3.svg.axis()
                                .scale(x)
                                .orient("bottom");

                            var yAxis = d3.svg.axis()
                                .scale(y)
                                .orient("left");

                            var line = d3.svg.line()
                                .x(function(d) { return x(d.timestamp); })
                                .y(function(d) { return y(d.value); });

                            var svg = d3.select(new_node).append("svg")
                                .attr("width", width + margin.left + margin.right)
                                .attr("height", height + margin.top + margin.bottom)
                              .append("g")
                                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                            // replace data with real data from attrs
                               /*
                            var data = [
                                {"timestamp": 1368992932147,
                                 "value": 1},
                                {"timestamp": 1368992942147,
                                 "value": 2},
                                {"timestamp": 1368992952147,
                                 "value": 3},
                                {"timestamp": 1368992962147,
                                 "value": 4}
                            ];
                                */
                

                            var newdata = [];

                            data.forEach(function(d) {
                              d.timestamp = +(new Date(d.timestamp)); // parse the date, and then turn into unix timestamp
                              d.value = + d.value; // convert to int from string 
                              if (!isNaN(d.value)){
                                newdata.push(d);
                              }
                            });
                            console.debug("Parsed data", newdata);

                            x.domain(d3.extent(newdata, function(d) { return d.timestamp; }));
                            y.domain(d3.extent(newdata, function(d) { return d.value; }));

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
                                .text(""); // y-axis text

                            svg.append("path")
                                .datum(newdata)
                                .attr("class", "line")
                                .attr("d", line);

						} catch(e) {
							console.error("error: " + e);
						}
                    };
					var update = function() {
						try {
							// run from inside safe apply

							var vals = $scope.model.get($scope.property) ? JSON.parse($scope.model.get($scope.property)[0]) : [];
							console.log('property ', $scope.property, vals);							
							update_chart($element, vals);
														
							// var ps = $attrs.property.split(',').map(function(x) { return x.trim(); });
// 							$scope.hello = ' '+ ps.map(function(p) {
// 								var v = $scope.model.get(p);
// 								return p + ": " + (v ? v.toString() : 'none');
// 							}).join(',');
//                             console.debug("element",$element);
//                             update_chart($attrs, $element);
// //                            $scope.chart = update_chart($attrs);
// 							console.log('TIME SERIES UPDATE > ', $scope.hello);
							
						} catch(e) {
							console.error(e);
						}
					};
					var context = { id : Math.random() };
					var old_model, old_box;
					var listen_and_update = function() {
						var model = $scope.model;
						if (old_model) { old_model.off(null, null, context); }
						if (model) {
							model.on('change', function() {
								try { $scope.$apply(update); }
								catch(e) {	webbox.safe_apply($scope, update);	}
							}, context);
							update();
						}
						old_model = model;
					};					
					webbox.loaded.then(function() {
						$scope.$watch('model', listen_and_update);
						$scope.$watch('box', listen_and_update);
					});
					webbox.safe_apply($scope, listen_and_update);
				}
			};
		});

}());
