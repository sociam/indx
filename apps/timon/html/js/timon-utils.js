/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine, angular, _, $ */
angular.module('timon').directive('entercall', function() { 
		return {
			// link:function($element, $attributes) { },
			controller:function($scope, $element, $attrs) { 
				var el = $element[0],
					fn = $attrs.entercall;
				console.log('element >> ', $scope, el, fn);
				$(el).on('keydown', function(evt) { 
					if (evt.keyCode == 13) { 
						$scope.$eval(fn); 
						evt.preventDefault();
					}
				});
			}
		};
	}).filter('orderObjectBy', function() {
		return function(items, field, reverse) {
		    var filtered = [];
		    angular.forEach(items, function(item) { filtered.push(item);  });
		    filtered.sort(function (a, b) {
		      var av = a.peek(field), bv = b.peek(field);
		      if (_.isDate(av)) { av = av.valueOf(); }
		      if (_.isDate(bv)) { bv = bv.valueOf(); }
		      return (av > bv ? 1 : -1);
		    });
		    if(reverse) filtered.reverse();
		    return filtered;
		};
	});