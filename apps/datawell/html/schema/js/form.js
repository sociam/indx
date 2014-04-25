/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */

angular.module('datawell', ['indx'])
	.directive('DataWellInputForm', function() { 
		return {
			replace:true,
			restrict:'E',
			scope:{src:'='},
			templateUrl:'partials/base.html',
			controller:function($scope, fmlParser, utils) {
				var u = utils, sa = function(fn) { return u.safeApply($scope, fn); };
				if ($scope.src !== undefined) {
					$.get($scope.src)
						.then(function(schematext) { 
							var tree = fmlParser.parse(schematext); 

						}).fail(function(x) { console.error(x); });
				}
			}
		};
	}).directive('DataWellInputComponent', function() { 
		return {
			replace:true,
			restrict:'E',
			scope:{src:'='},
			templateUrl:'partials/component.html',
			controller:function($scope, utils, prov) {
				var u = utils, sa = function(fn) { return u.safeApply($scope, fn); };
				if ($scope.src !== undefined) {
					$.get($scope.src)
						.then(function(schematext) { 
							var tree = fmlParser.parse(schematext); 

						}).fail(function(x) { console.error(x); });
				}
			}
		};	
	});
