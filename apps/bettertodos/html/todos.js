/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils) {
		'use strict';


		var urgencies = ['low', 'med', 'high', 'urgent'];

		var u = utils,
			newList,
			newTodo,
			app,
			box;

		var specialLists = [
			new Backbone.Model({ id: 'todo-list-all', title: ['All todos'], special: ['all'], todos: [] }),
			new Backbone.Model({ id: 'todo-list-completed', title: ['Completed'], special: ['completed'], todos: [] })
		];

		// Wait until user is logged in and a box has been selected
		var init = function (b) {
			console.log('init');

			box = b;

			box.getObj('todoApp').then(function (a) {
				app = a;
				if (!app.has('lists')) { app.set('lists', []); }
				updateLists();
				app.on('change:lists', updateLists);
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
		};

		$scope.selectList = function (list) {
			if (state.selectedList) {
				state.selectedList.off('change:todos', updateTodos);
			}
			state.selectedList = list;
			updateTodos();
			list.on('change:todos', updateTodos);
		};

		$scope.deleteList = function (list) {
			list.destroy().then(function () {
				var lists = app.get('lists');
				lists.splice(lists.indexOf(list), 1);
				app.save('lists', lists).then(function () {
					updateLists();
				});
			});
		};

		$scope.cancelEditList = function () {
			console.log('cancel')
			delete state.editingList;
			newList = undefined;
			updateLists();
		};

		$scope.saveList = function (list) {
			var dfd = $.Deferred();
			list.loading = true;
			if (list.get('title')[0] === '') {
				dfd.reject();
			} else {
				list.save().then(function () {
					console.log('SAVED', list.get('title'))
					if (list === newList) {
						newList = undefined;
						app.save('lists', [app.get('lists')].concat([list])).then(function () {
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
			console.log('UPDATING LISTS');
			// update special lists;
			var specialAll = _.findWhere(specialLists, { id: 'todo-list-all' }),
				specialCompleted = _.findWhere(specialLists, { id: 'todo-list-completed' });

			specialAll.set('todos', _.reduce(app.get('lists'), function (memo, list) {
				return memo.concat(list.get('todos') || []);
			}, []));

			specialCompleted.set('todos', _.filter(specialAll.get('todos'), function (todo) {
				return (todo.get('completed') || [])[0];
			}));


			$scope.lists = [].concat(app.get('lists'), specialLists);
			console.log($scope.lists)
			_.each($scope.lists, function (list) {
				if (!list.has('title')) { list.set('title', ['Untitled list']) }
				if (!list.has('todos')) { list.set('todos', []) }
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
		};



		// todo - check box is defined (or put in init)
		$scope.createTodo = function (before) {
			box.getObj('todo-'  + u.uuid()).then(function (todo) {
				todo.set({ title: [''], order: [before - 0.5] });
				newTodo = todo;
				updateTodos();
				$scope.editTodo(todo);
			});
		};

		$scope.editTodo = function (todo) {
			state.editingTodo = todo;
		}

		$scope.cancelEditTodo = function () {
			delete state.editingTodo;
			newTodo = undefined;
			updateTodos();
		};

		$scope.saveTodo = function (todo) {
			var dfd = $.Deferred(),
				list = state.selectedList;
			todo.loading = true;
			console.log('SAVE', todo.get('title'), todo.toJSON())
			if (todo.get('title')[0] === '') {
				dfd.reject();
			} else {
				todo.save().then(function () {
					console.log('SAVED', list.get('title'))
					if (todo === newTodo) {
						newTodo = undefined;
						list.save('todos', list.get('todos').concat([todo])).then(function () {
							dfd.resolve();
						});
					} else {
						dfd.resolve();
					}
				});
			}
			dfd.then(function () {
				delete state.editingTodo;
				delete todo.loading;
				updateTodos();
			});
		}

		var updateTodos = function () {
			var list = state.selectedList;
			$scope.todos = [].concat(list.get('todos'));
			console.log($scope.todos)
			var lastOrder = 0;
			_.each($scope.todos, function (todo) {
				if (!todo.has('title')) { todo.set('title', ['Untitled todo']) }
				if (!todo.has('order')) { todo.set('order', [lastOrder + 1]); }
				if (!todo.has('completed')) { todo.set('completed', [false]); }
				lastOrder = todo.get('order')
			});
			if (newTodo) { $scope.todos.push(newTodo); }
			$scope.todos = _.sortBy($scope.todos, function (todo) {
				return todo.get('order')[0];
			})
			$update();
		};

		$scope.toggleTodoCompleted = function (todo) {
			todo.loading = true;
			todo.save('completed', [!todo.get('completed')[0]]).then(function () {
				todo.loading = false;
				updateTodos();
				updateLists();
			});
		};

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