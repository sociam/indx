/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $, d3 */

(function() {
	var vApp = angular.module('vitality');
	vApp.config(function($stateProvider) {
		$stateProvider.state('scribble-test', {
			url: '/scribble-test',
			templateUrl: 'partials/scribble-input.html',
			resolve: {
				who: function(client, utils) { 
					var u = utils, d = u.deferred();
					client.store.checkLogin().then(function(x) { d.resolve(x);	}).fail(d.reject);
					return d.promise();
				}
			},
			controller: function($scope, $state, $stateParams, who, utils, dateutils, entities, prov) {
				var u = utils, du = dateutils,
					sa = function(fn) { return u.safeApply($scope, fn); },
					$s = $scope,
					box;
			}
		});
	}).directive('scribble', function () {
		return {
			restrict:'E',
			replace:true,
			scope:{model:"="},
			templateUrl:'partials/scribbler.html',
			controller:function($scope, utils)  {

				var u = utils, 
					sa = function(fn) { return u.safeApply($scope, fn); },
					$s = $scope;

				$scope.$watch('element', function(element) { 
					console.log('element >> ', el);
					var el = element[0], data = [];
					$scope.data = data;
					var cur_line = undefined;
					var svg = d3.select(el).append('svg');

					var offset;
					var linefn = d3.svg.line()
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; })
						.interpolate('linear');

					var render = function() { 
						svg.selectAll('path.drawing').remove();
						if (cur_line) {
							svg.append('path')
								.attr('class', 'scribble drawing')
								.attr('d', linefn(cur_line));
						}
					};
					var evt2pos = function(evt) { 
						if (!offset) { offset = $(svg[0]).offset(); }
						return { x: evt.originalEvent.touches[0].clientX - offset.left, y: evt.originalEvent.touches[0].clientY - offset.top };
					};
					var clear_select = function() { 
						d3.selectAll('.scribble.selected').attr('class', 'scribble');
						sa(function() { delete $scope.selected_path; });
					};				
					var click_handler = function(evt){
						var this_ = this;
						clear_select();
						// select!
						d3.select(this).attr('class', 'scribble selected');
						sa(function() { $scope.selected_path = this_; });
					};
					$(svg[0]).on('touchstart', function(evt) { 
						clear_select();
						cur_line = [ evt2pos(evt) ];
					});
					$(svg[0]).on('touchend', function(evt) { 
						console.log('<< touchend >> ', evt);
						sa(function() { data.push(cur_line); });
						svg.selectAll('path.drawing')
							.attr('class', 'scribble')
							.on('click', click_handler);
						cur_line = undefined;
					});
					$(svg[0]).on('touchmove', function(evt, e) {
						evt.preventDefault();					
						cur_line.push(evt2pos(evt));
						render();
					});
					$scope.deleteSelected = function() {
						if (!$scope.selected_path) { return; }
						var selected = $scope.selected_path;
						var selected_points = d3.select(selected).attr('data-points');
						var ii = d3.selectAll('path.scribble')[0].indexOf(selected);
						data.splice(ii,1);
						d3.select(selected).remove();
						clear_select();
						return true;
					};
					$scope.deleteLast = function() { 
						var paths = svg.selectAll('path.scribble')[0];
						data.splice(data.length-1,1);
						if (paths.length > 0) {
							d3.select(paths[paths.length -1]).remove();
						}
						clear_select();
						return true;
					};

				}); // watch element
			},
			link:function($scope, $element) {
				$scope.element = $element;
			}
		};
	});
})();