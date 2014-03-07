/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $ */

angular
.module('aditl')
.controller('diary', function($scope, client, utils, dateutils, entities) {

	var u = utils, 
		sa = function(fn) { return u.safeApply($scope, fn); },
		$s = $scope,
		box;

	$s.madlibs = [
		{ text: 'i\'m feeling...', range: ['happy', 'sad', 'indifferent'] },
		{ text: 'i\'m ...', range:['working', 'relaxing', 'doing some sport'] },
		{ text: 'i like to ...' },
		{ text: 'i wish i could ... '}
	];

	$s.dow_names = dateutils.weekday;
	$s.month_names = dateutils.months;

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
			entities.activities.getByActivityType(box,dstart,dend,['diary']).then(function(x)  { 
				sa(function() { 
					$s.selected_day.entries = x;
				});
			});
		}
	};

	$s.selectNextDay = function() { $s.selectDay(dateutils.dayAfter($s.selected_day.date));	};
	$s.selectPrevDay = function() { $s.selectDay(dateutils.dayBefore($s.selected_day.date));	};
	$s.showEntryPopup = function() { 
		console.log('show entry popup');
		$s.entryPopup = true;
		setTimeout(function() { $('#entrybox').focus(); }, 200);
	};
	$s.doneEntryPopup = function() { 
		if ($s.entrytext !== undefined && $s.entrytext.trim().length > 0) {
			console.log('saving text ... ', $s.entrytext);
			$s.addTextEntry($s.entrytext);
		}
		$s.entrytext = '';
		$s.entryPopup = false;
	};
	$s.addTextEntry = function(t) {
		var now = new Date(), d = u.deferred();
		entities.activities.make1(box, 'journal', now, now, undefined, undefined, undefined, undefined, { 
			journaltype:'text',
			contents:'t'
		}).then(function(obj) { d.resolve(obj); }).fail(d.reject);
		return d.promise();
	};
	$s.addPhraseEntry = function(p) {
		var now = new Date(), d = u.deferred();
		entities.activities.make1(box, 'journal', now, now, undefined, undefined, undefined, undefined, { 
			journaltype:'phrase',
			phrase:p.text,
			value:''
		}).then(function(obj) { d.resolve(obj); }).fail(d.reject);
		return d.promise();		
	};
	$s.$watch('user + box', function() { 
		if ($s.box) {
			client.store.getBox($s.box).then(function(b) { 
				box = b;
				$s.selectDay();
			});
		}
	 });

	window.$s = $s;

}).directive('diary-entry', function() { 
	return {
		restrict:'E',
		scope: {'entry' : '='},
		templateUrl:'templates/diary-entry.html',
		controller:function()  {

		}
	};
});
