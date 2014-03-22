/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $, d3 */

angular
.module('aditl')
.controller('diary', function($scope, client, utils, dateutils, entities) {

	var u = utils, du = dateutils,
		sa = function(fn) { return u.safeApply($scope, fn); },
		$s = $scope,
		whom, box;

	$s.isToday = du.isToday;
	$s.madlibs = [
		{ text: 'i\'m feeling...', range: ['happy', 'sad', 'indifferent'] },
		{ text: 'i\'m ...', range:['working', 'relaxing', 'doing some sport'] },
		{ text: 'i like to ...' },
		{ text: 'i wish i could ... '}
	];
	$s.dow_names = du.weekday;
	$s.month_names = du.months;

	$s.selectDay = function(date) { 
		if (date === undefined){
			if ($s.selected_day && $s.selected_day.date) { 
				date = $s.selected_day.date; 
			} else {
				date = new Date();
			}
		}
		var dstart = new Date(date.valueOf()); dstart.setHours(0,0,0,0);
		var dend = new Date(date.valueOf()); dend.setHours(23,59,59,999);
		$s.selected_day = {
			date : dstart,
			dend : dend,
			entries: []
		};
		if (box) { 
			entities.activities.getByActivityType(box,dstart,dend,['diary-entry-created']).then(function(x)  { 
				sa(function() { 
					x.sort(function(a,b) { return a.peek('tstart').valueOf() - b.peek('tstart').valueOf(); });
					$s.selected_day.entries = x;
				});
			});
		}
	};

	$s.selectNextDay = function() { $s.selectDay(du.dayAfter($s.selected_day.date));	};
	$s.selectPrevDay = function() { $s.selectDay(du.dayBefore($s.selected_day.date));	};
	$s.showEntryPopup = function() { 
		$s.entryPopup = true;
		setTimeout(function() { $('#entrybox').focus(); }, 200);
	};
	$s.addTextEntry = function(t) {
		$s.entryPopup = false;
		var now = new Date(), d = u.deferred();
		entities.activities.make1(box, 'diary-entry-created', whom, now, now, undefined, undefined, undefined, undefined, { 
			journaltype:'text',
			value:t
		}).then(function(obj) { 
			console.log('saving --- ', obj); 
			sa(function() { $s.selected_day.entries.push(obj);	});
			obj.save(); 
			d.resolve(obj); 
		}).fail(d.reject);
		return d.promise();
	};
	$s.addPhraseEntry = function(p) {
		$s.entryPopup = false;		
		var now = new Date(), d = u.deferred();
		entities.activities.make1(box, 'diary-entry-created', whom, now, now, undefined, undefined, undefined, undefined, { 
			journaltype:'phrase',
			phrase:p.text,
			range:p.range,
			value:p.value
		}).then(function(obj) { 
			console.log('saving --- ', obj); 
			obj.save(); 
			sa(function() { $s.selected_day.entries.push(obj);	});
			d.resolve(obj); 
		}).fail(d.reject);
		return d.promise();		
	};
	$s.$watch('user + box', function() { 
		if ($s.box) {
			client.store.getBox($s.box).then(function(b) { 
				box = b;
				if ($s.user !== undefined) {
					b.getObj($s.user.username).then(function(whom_) {
						console.log('whom >> ', whom_);
						whom = whom_;
						$s.selectDay();
					});
				} else {
					$s.selectDay();
				}
			});
		}
	 });

	// $(document).click(function() { sa(function() { $s.entryPopup = false; }); });

	window.$s = $s;

}).directive('diaryEntry', function() { 
	return {
		restrict:'E',
		scope: {'entry' : '=', 'entries':'='},
		templateUrl:'templates/diary-entry.html',
		controller:function($scope, utils)  {
			var u = utils, 
				sa = function(fn) { return u.safeApply($scope, fn); },
				$s = $scope;

			$s.deleteMe = function(entry) {	
				entry.destroy(); 
				$s.entries = $s.entries.filter(function(x) { return x !== entry; });
			};
			$s.$watch('entry', function() { 
				var entry = $s.entry;
				$s.entryvalue = (entry !== undefined ? entry.peek('value') : ''); 
			});
			$s.$watch('entryvalue', function(x) { 
				// console.log('setting value -- ', x, $s.entryvalue);
				$s.entry.set('value', x);
				$s.entry.save();
			});
			$s.toTimeString = function(d) {
				console.error('tts >> ', d, d3.time.format('%I:%M %p')(d).toLowerCase());
				return d3.time.format('%I:%M %p')(d).toLowerCase();
			};


			window.$se = $scope;
		}
	};
}).directive('autoExpandingTextarea', function () {
	return {
		restrict:'E',
		replace:true,
		template:'<textarea class=\'auto-expanding-textarea\'></textarea>',
		controller:function($scope, utils)  {
			var u = utils, 
				sa = function(fn) { return u.safeApply($scope, fn); },
				$s = $scope;
		},
		link:function($scope, $element) {
			var el = $element[0], last_length = 0;
			var minheight = $(el).css('min-height') && parseInt($(el).css('min-height').slice(0,-2)) || 0;
			console.log('link element >> ');
			var twerk = function() {
				var value = el.value;
				console.log('sh ', el.scrollHeight, 'oh: ', $(el).outerHeight());
				if (el.scrollHeight > $(el).outerHeight()) {
					$(el).height(el.scrollHeight + 10);
				}

				if (value.length < last_length) { 
					console.error('shrink!', 'initial h :: ', 'scrollHeight', el.scrollHeight, ' outerheight ', $(el).outerHeight(), minheight);
					$(el).height(minheight);
					$(el).height(el.scrollHeight + 10);					
					// setTimeout(function() { $(el).height(el.scrollHeight); }, 100);
				}
				last_length = value.length;
		    };
		    $(el).keydown(twerk);
		    // $scope.watch('model', function(x) { console.log('model! ', x);    });
			$(el).keyup(twerk);
			$scope.$watch('model', function(x) { console.log('model! ', x);  twerk();  });			
		}
	};
});
