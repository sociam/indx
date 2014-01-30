/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils) {
		'use strict';


		var urgencies = ['low', 'med', 'high', 'urgent'];

		var u = utils,
			newList,
			app,
			box;

		// Wait until user is logged in and a box has been selected
		var init = function (b) {
			console.log('init');

			box = b;

			box.getObj('todoApp').then(function (a) {
				app = a;
				if (!app.has('lists')) { app.set('lists', []); }
				updateLists();
				
				app.on('change:lists', function () {
					updateLists();
				});
				u.safeApply($scope);
			});

		};

		// watches for login or box changes
		$scope.$watch('selectedBox + selectedUser', function () {
			delete $scope.msg;
			if (!$scope.selectedUser) {
				$scope.msg = 'Please log in.';
			} else if (!$scope.selectedBox) {
				$scope.msg = 'Please select a box.';
			} else {
				client.store.getBox($scope.selectedBox)
					.then(function (box) { init(box); })
					.fail(function (e) { u.error('error ', e); $scope.msg = 'An error occured.'; });
			}
			
		});

		// todo - check box is defined (or put in init)
		$scope.createList = function () {
			box.getObj('todoList-'  + u.uuid()).then(function (list) {
				list.set({ title: [''] });
				newList = list;
				updateLists();
				$scope.editList(list);
			});
		};

		$scope.editList = function (list) {
			state.editingList = list;
			list.showDropdown = false;
		}

		$scope.cancelEditList = function () {
			console.log('cancel')
			delete state.editingList;
			newList = undefined;
			updateLists();
		};

		$scope.saveList = function (list) {
			var dfd = $.Deferred();
			list.loading = true;
			console.log('SAVE', list.get('title'), list.toJSON())
			if (list.get('title')[0] === '') {
				dfd.reject();
			} else {
				list.save(list.toJSON()).then(function () {
					console.log('SAVED', list.get('title'))
					if (list === newList) {
						newList = undefined;
						app.save('lists', [list].concat(app.get('lists'))).then(function () {
							dfd.resolve();
						});
					} else {
						dfd.resolve();
					}
				});
			}
			dfd.then(function () {
				delete state.editingList;
				delete list.loading;
				updateLists();
			});
		}

		var updateLists = function () {
			$scope.lists = [].concat(app.get('lists'));
			console.log($scope.lists)
			_.each($scope.lists, function (list) {
				if (!list.has('title')) { list.set('title', ['Untitled list']) }
			});
			if (newList) { $scope.lists.push(newList); }
			$update();
		}

		var $update = function () {
			console.log('$UPDATE', state.editingList)
			u.safeApply($scope);
		};

		$scope.bodyClick = function () {
			$scope.lists.forEach(function (list) {
				//list.showDropdown = false;
			});
		}

		var state = $scope.s = {};

		window.$scope = $scope;


	}).directive('setFocus', function($timeout) {
		return {
			link: function(scope, element, attrs) {
				scope.$watch(attrs.setFocus, function (value) {
					console.log(value)
					if (value === true) { 
						element[0].focus();
						scope[attrs.focusMe] = false;
					}
				});
			}
		};
	});;