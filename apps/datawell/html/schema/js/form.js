/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */

angular.module('datawell')
	.directive('fmlform', function() { 
		return {
			restrict:'E',
			scope:{ formsrc:'@' },
			templateUrl:'partials/base.html',
			controller:function($scope, fmlParser, utils) {
				var u = utils, sa = function(fn) { return u.safeApply($scope, fn); };
				if ($scope.formsrc !== undefined) {
					console.info('loading from ', $scope.formsrc);
					$.get($scope.formsrc).then(function(schematext) { 
						var tree = fmlParser.parse(schematext); 
						if (tree !== undefined) {
							sa(function() { $scope.root = tree;	});
						}
					}).fail(function(x) { console.error(x); });
				} else {
					console.error('no src provided');
				}
			}
		};
	}).directive('component', function() { 
		return { restrict:'E', scope:{root:'='}, templateUrl:'partials/component.html' };	
	}).directive('group', function() { 
		return { replace:true, restrict:'E', scope:{root:'='}, templateUrl:'partials/group.html' };	
	}).directive('category', function() { 
		return { replace:true, restrict:'E', scope:{root:'='}, templateUrl:'partials/category.html' };	
	}).directive('inputItem', function() { 
		return { replace:true, restrict:'E', scope:{root:'='}, templateUrl:'partials/inputitem.html' };
	});
