/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $, d3 */

(function() {
	var vApp = angular.module('vitality');

	vApp.config(function($stateProvider) {
		$stateProvider.state('diary', {
			url: '/diary/:entry',
			templateUrl: 'partials/diary.html',
			resolve: {
				who: function(client, utils) { 
					var u = utils, d = u.deferred();
					client.store.checkLogin().then(function(x) { d.resolve(x);	}).fail(d.reject);
					return d.promise();
				}
			},
			controller: function($scope, $state, $stateParams, who, utils, dateutils, entities) {
				var u = utils, du = dateutils,
					sa = function(fn) { return u.safeApply($scope, fn); },
					$s = $scope,
					whom, box;

				var	_init = function(entryid) {
					var date = entryIdToDate(entryid), 
						dstart = du.midnight(date), 
						dend = du.lastMSecOf(date);
					$scope.selected_day = {	date : dstart, dend : dend,	entries: [] };
					if (!box) { return; }
					entities.activities.getByActivityType(box,dstart,dend,['diary-entry-created']).then(function(x)  { 
						sa(function() { 
							x.sort(function(a,b) { return a.peek('tstart').valueOf() - b.peek('tstart').valueOf(); });
							$scope.selected_day.entries = x;
						});
					});
				},
				entryIdToDate = function(eid) { 
					if (eid.toLowerCase().trim() === 'today') { return new Date(); }
					var re = /([0-9]{2})\-([0-9]{2})\-([0-9]{4})/;
					var d = re.exec(eid);
					if (d && d.length > 0) { 
						var td = new Date();
						td.setDate(parseInt(d[1]));
						td.setMonth(parseInt(d[2])-1);
						td.setYear(parseInt(d[3]));
						td = du.midnight(td);
						return td;
					}
					return new Date();
				},
				dateToEntryId = function(date) { return d3.time.format('%d-%m-%Y')(date); },
				selectDay = function(day) {	
					console.log('select Day', day);
					$state.go('diary', { entry: dateToEntryId(day) } );	
				};

			$s.selectNextDay = function() { 
				selectDay(du.dayAfter($s.selected_day.date)); 
			};
			$s.selectPrevDay = function() { 
				selectDay(du.dayBefore($s.selected_day.date)); 
			};
			$s.isToday = du.isToday;
			$s.showEntryPopup = function() { 
				$s.entryPopup = true;
				setTimeout(function() { $('#entrybox').focus(); }, 200);
			};
			$s.addTextEntry = function(t) {
				delete $s.entryPopup;
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
				delete $s.entryPopup;
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

			if (!$stateParams.entry || $stateParams.entry.trim().length === 0) { $state.go('diary', { entry:'today' });	}
			$s.dow_names = dateutils.weekday;
			$s.month_name = dateutils.months;				
			$s.$watch('box', function() { box = $scope.box;	_init($stateParams.entry); });
		}
	});
	}).directive('diaryEntry', function() { 
		return {
			restrict:'E',
			scope: {'entry' : '=', 'entries':'='},
			templateUrl:'partials/diary-entry.html',
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
				var twerk = function(e) {
					var dh = $(document).height();
					$('body').height(dh);
					$(el).height(minheight);
					// console.log('doc height ', $(document).height(), dh);
					$(el).height(el.scrollHeight + 20);
				};
			    $(el).keyup(twerk);
			    $scope.$watch('model', function(x) { console.log('model! ', x);  twerk();  });			
			}
		};
	});
})();