/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $ */

(function() {
	angular.module('vitality').factory('dateutils', function() { 
		return {
			weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
			months: [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ],
			dayAfter:function(d) {
				return new Date(d.valueOf() + 24*3600*1000);
			},
			dayBefore:function(d) { 
				return new Date(d.valueOf() - 24*3600*1000);
			},
			midnight:function(d) { 
				var td = new Date(d.valueOf());
				td.setHours(0,0,0,0);
				return td;
			},
			lastMSecOf:function(d) { 
				var td = new Date(d.valueOf());
				td.setHours(23,59,59,999);
				return td;
			},
			isToday : function(d) { 
				var today = new Date();
				return d !== undefined && d.getDate() == today.getDate() && d.getYear() == today.getYear() && d.getMonth() == today.getMonth();
			}
		};
	});	
})();