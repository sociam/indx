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
			controller: function($scope, $state, $stateParams, who, utils, dateutils, entities, prov) {
				var u = utils, du = dateutils,
					sa = function(fn) { return u.safeApply($scope, fn); },
					$s = $scope,
					box;

				var	_init = function(entryid) {
					var date = entryIdToDate(entryid), 
						dstart = du.midnight(date), 
						dend = du.lastMSecOf(date),
						query = ({
							'$and':[ 
							{'created': {'$ge': u.toQueryTime(dstart) }},
							{'created': {'$le': u.toQueryTime(dend) }},							
							{type:'diary-entry'}
						]});
					$scope.selected_day = {	date : dstart, dend : dend,	entries: [] };
					if (!box) { return; }
					box.query(query).then(function(entries)  {
						console.log('got entries >> ', entries);
						entries.sort(function(a,b) { return a.peek('created').valueOf() - b.peek('created').valueOf(); });
						sa(function() { $scope.selected_day.entries = entries; });
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
			$s.addTextEntry = function() {
				delete $s.entryPopup;
				var now = new Date(),
					d = u.deferred(),
					id = 'diary-entry-' + u.guid();
				box.getObj(id).then(function(obj) { 
					obj.set({
						created: new Date(),
						author: who,
						'type': 'diary-entry',
						'journaltype': 'text',
						value:''
					}).save().then(function() { d.resolve(obj); }).fail(d.reject);
					sa(function() { $s.selected_day.entries.push(obj); });
					prov.makeCreatedProv(box, $s.whom, $s.entry, new Date());					
				}).fail(d.reject);
				return d.promise();
			};
			$s.addPhraseEntry = function(p) {
				delete $s.entryPopup;
				var now = new Date(), d = u.deferred(),
					id = 'diary-entry-' + u.guid();
				box.getObj(id).then(function(obj) { 
					obj.set({
						created: new Date(),
						author: who,
						'type': 'diary-entry',
						'journaltype': 'phrase',
						phrase:p,
						range:p.range,
						value:''
					}).save().then(function() { d.resolve(obj); }).fail(d.reject);
					prov.makeCreatedProv(box, $s.whom, $s.entry, new Date());
				}).fail(d.reject);
				return d.promise();		
			};
			$s.toggleEntryPopup = function() { 
				console.log('entrypopup >> ', $s.entryPopup);
				$s.entryPopup = !$s.entryPopup; 
			};

			if (!$stateParams.entry || $stateParams.entry.trim().length === 0) { $state.go('diary', { entry:'today' });	}
			$s.dow_names = dateutils.weekday;
			$s.month_names = dateutils.months;				
			$s.$watch('box', function() { box = $scope.box;	_init($stateParams.entry); });
			$s.whom = who; // for subscopes
		}
	});
	}).directive('diaryEntry', function() { 
		return {
			restrict:'E',
			replace:true,
			scope: {'entry' : '=', 'entries':'=', 'box':'=', 'whom':'='},
			templateUrl:'partials/diary-entry.html',
			controller:function($scope, $timeout, utils, prov)  {
				var u = utils, 
					sa = function(fn) { return u.safeApply($scope, fn); },
					$s = $scope,
					timeout;
				$s.deleteMe = function(entry) {	
					entry.destroy(); 
					prov.makeDeletedProv($s.box, $s.whom, entry, new Date());
					$s.entries = $s.entries.filter(function(x) { return x !== entry; });
				};
				$s.$watch('entry', function() { 
					var entry = $s.entry;
					entry.entryvalue = (entry !== undefined ? entry.peek('value') : ''); 
				});
				$s.$watch('entry.entryvalue', function(x) { 
					// console.log('setting value -- ', x, $s.entryvalue);
					if (timeout) { 
						console.log('clearing .. ');
						$timeout.cancel(timeout);
					}
					timeout = $timeout(function() { 
						console.log('... saving');
						$s.entry.set('value', x);
						$s.entry.save();
						console.log('make edited prov >> ', $s.box);
						if ($s.box) {
							prov.makeEditedProv($s.box, $s.whom, $s.entry, 'value', x, new Date());
						} else {
							console.error('no $s.box');
						}
						timeout = undefined;
					}, 1000);

				});
				$s.toTimeString = function(d) {
					// console.error('tts >> ', d, d3.time.format('%I:%M %p')(d).toLowerCase());
					return d3.time.format('%I:%M %p')(d).toLowerCase();
				};
			}
		};
	}).directive('autoExpandingTextarea', function () {
		return {
			restrict:'E',
			replace:true,
			scope:{model:"="},
			template:'<div class="auto-expanding-textarea-container"><textarea ng-model="model" class=\'auto-expanding-textarea\'></textarea></div>',
			controller:function($scope, utils)  {
				var u = utils, 
				sa = function(fn) { return u.safeApply($scope, fn); },
				$s = $scope;
				console.log("model is ", $scope.model);
			},
			link:function($scope, $element) {
				var el = $element.find('textarea')[0], div = $element[0], last_length = 0;
				var minheight = $(el).css('min-height') && parseInt($(el).css('min-height').slice(0,-2)) || 0;
				var twerk = function(e) {
					$(div).height($(div).height() + 50);
					$(el).height(minheight);
					$(el).height(el.scrollHeight + 20);
					$(div).height('auto');
				};
			    $(el).keyup(twerk);
			    $scope.$watch('model', function(x) { twerk();  $(el).focus(); });			

			}
		};
	});
})();