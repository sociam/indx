/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $, d3 */

(function() {
	var vApp = angular.module('vitality');
	vApp.config(function($stateProvider) {
		$stateProvider.state('clinical-input', {
			url: '/input',
			templateUrl: 'partials/clinical-input.html',
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
			template:'<div class="scribbler"></div>',
			controller:function($scope, utils)  {
				var u = utils, 
				sa = function(fn) { return u.safeApply($scope, fn); },
				$s = $scope;
			},
			link:function($scope, $element) {
				var el = $element[0], div = $element[0], last_length = 0;
				var data = [];
				var cur_line = undefined;
				var svg = d3.select(el).append('svg'); // .attr('width', 500).attr('height', 800);
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

				$(el).find('path.scribble').on('touchstart', function(evt) { 
					console.error('YOOOOOOOOO scribble click!! ', this, evt.currentTarget);
					$('.scribble.selected').removeClass('.selected');
					$(this).addClass('selected');
					evt.preventDefault();					
				});
				$(el).on('touchstart', function(evt) { 
					console.log('touchstart >> ', evt);
					cur_line = [ evt2pos(evt) ];
				});
				$(el).on('touchend', function(evt) { 
					console.log('<< touchend >> ', evt);
					data.push(cur_line);
					svg.selectAll('path.drawing').attr('class', 'scribble');
					cur_line = undefined;
				});
				$(el).on('touchmove', function(evt, e) {
					// console.log('<< touchdrag ', evt, e);
					evt.preventDefault();					
					window.evt = evt; 
					cur_line.push(evt2pos(evt));
					render();
				});
				window.data = data;
			}
		};
	});
})();