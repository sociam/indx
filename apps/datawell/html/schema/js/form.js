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
	}).directive('component', function(RecursionHelper) { 
		return { 
			restrict:'E', scope:{root:'='}, templateUrl:'partials/component.html',
			compile: function(element) {
	            return RecursionHelper.compile(element, function(scope, iElement, iAttrs, controller, transcludeFn){});
	        },
	        controller:function($scope) {
	        	console.log('root is > ', $scope.root);
	        }
		};	
	}).directive('group', function(RecursionHelper) { 
		return { replace:true, restrict:'E', scope:{root:'='}, templateUrl:'partials/group.html',
			compile: function(element) {
	            return RecursionHelper.compile(element, function(scope, iElement, iAttrs, controller, transcludeFn){});
	        }
		 };	
	}).directive('category', function(RecursionHelper) { 
		return { replace:true, restrict:'E', scope:{root:'='}, templateUrl:'partials/category.html',
			compile: function(element) {
	            return RecursionHelper.compile(element, function(scope, iElement, iAttrs, controller, transcludeFn){});
	        }
	    };
	}).directive('inputitem', function(RecursionHelper) { 
		return { replace:true, restrict:'E', scope:{item:'='}, templateUrl:'partials/inputitem.html',
			compile: function(element) {
	            return RecursionHelper.compile(element, function(scope, iElement, iAttrs, controller, transcludeFn){
	            	// console.log('iElement > ', iElement[0]);
	            	// console.log('')
	            });
	        },
	        controller:function($scope) {	        	
	        	$scope.$watch('item.selected', function(sel) { 
	        		console.log('scope item selected >> ', $scope.item, $scope.item.selected); 
	        	});
	        }
	    };
	});
