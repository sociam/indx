/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.factory('listsFactory', function (todosFactory, staged) {
		var box, app, newList, newTodo;

		var factory;

		var specialLists = [
			new Backbone.Model({ id: 'todo-list-all', title: ['All todos'], special: ['all'], todos: [] }),
			new Backbone.Model({ id: 'todo-list-completed', title: ['Completed'], special: ['completed'], todos: [] })
		];

		var init = function (b) {
			console.log('lists.init');
			box = b;
			app = undefined;
			newList = undefined;
			newTodo = undefined;
			box.getObj('todoApp').then(function (a) {
				app = a;
				if (!app.has('lists')) { app.set('lists', []); }
				update();
				app.on('change:lists', update);
			});
		};

		var update = function () {
			console.log('lists.update');
			// update special lists;
			var specialAll = _.findWhere(specialLists, { id: 'todo-list-all' }),
				specialCompleted = _.findWhere(specialLists, { id: 'todo-list-completed' });

			specialAll.set('todos', _.reduce(app.get('lists'), function (memo, list) {
				return memo.concat(_.map(list.get('todos'), function (todo) {
					return _.extend({ list: list }, todo);
				}));
			}, []));

			specialCompleted.set('todos', [].concat(specialAll.get('todos')));

			_.each(app.get('lists'), function (list) {
				if (!list.has('title')) { list.set('title', ['Untitled list']) }
				if (!list.has('todos')) { list.set('todos', []); }
				list.off('change', update).on('change', update);
				list.isCreated = function () { return true; }
			});

			var lists = [].concat(app.get('lists')),
				basicLists = [].concat(app.get('lists'));

			
			if (newList) { lists.push(newList); }

			if (lists.length === 0) {
				create();
				return;
			}

			lists = lists.concat(specialLists);

			_.each(lists, function (list) {
				if (!list.staged) { staged(list); } // add staging to each list

				list.set('count', [_.reject(list.get('todos'), function (todo) {
					var reject = todo.has('completed') && todo.get('completed')[0];
					if (list.has('special') && list.get('special')[0] === 'completed') {
						reject = !reject;
					}
					return reject;
				}).length]);
			});

			factory.trigger('update', lists, basicLists);
		};

		var create = function () {
			console.log('lists.create');
			var dfd = $.Deferred();
			box.getObj('todoList-'  + u.uuid()).then(function (list) {
				list.set({ title: [''], 'todos': [] });
				newList = list;
				update();
				list.isCreated = function () { return false; }
				dfd.resolve(list);
			});
			return dfd;
		};

		var cancel = function (list) {
			list.staged.reset();
			if (list === newList) {
				newList = undefined;
			}
			update();
		};

		var remove = function (list) {
			console.log('lists.remove');
			var dfd = $.Deferred();
			list.isDeleting = true;
			list.destroy().then(function () {
				var lists = [].concat(app.get('lists'));
				lists.splice(lists.indexOf(list), 1);
				app.save('lists', lists).then(function () {
					update();
					dfd.resolve();
				});
			});
			return dfd;
		};

		var save = function (list) {
			console.log('lists.save');
			var dfd = $.Deferred();
			list.loading = true;
			if (list.staged.get('title')[0] === '') {
				dfd.reject();
			} else {
				list.staged.save().then(function () {
					list.isCreated = function () { return true; }
					console.log('SAVED', list.get('title'),app.get('lists'), [list])
					if (list === newList) {
						newList = undefined;
						app.save('lists', app.get('lists').concat([list])).then(function () {
							console.log('updated list', app.get('lists'))
							dfd.resolve();
						});
					} else {
						dfd.resolve();
					}
				});
			}
			dfd.then(update);
			return dfd;
		};

		factory = _.extend({
			init: init,
			create: create,
			update: update,
			remove: remove,
			save: save,
			cancel: cancel
		}, Backbone.Events);

		return factory;
	})
	.factory('todosFactory', function () {
		var list;
		var init = function (l) {
			console.log('todos.init');
			list = l;
		}
		var createBefore = function (todo) {
			box.getObj('todo-'  + u.uuid()).then(function (todo) {
				var nextOrder = next ? next.get('order')[0] : 0,
					prev = _.chain(state.selectedList.get('todos')).sortBy(function (_todo) {
						return -_todo.get('order')[0];
					}).find(function (_todo) {
						return !next || (_todo.get('order')[0] < nextOrder);
					}).value(),
					prevOrder = prev ? prev.get('order')[0] : 0,
					order = 0;

				if (next && prev) {
					order = prevOrder + (nextOrder - prevOrder) / 2
				} else if (prev) {
					order = prevOrder + 1;
				}

				console.log('NP', /*next, prev, */nextOrder, prevOrder, order)
				todo.set({ title: [''], order: [order] });
				newTodo = todo;
				updateTodos();
			});
		};

		var save = function (todo) {
			var dfd = $.Deferred(),
				list = state.selectedList;
			todo.loading = true;
			if (todo.staged.get('title')[0] === '') { // delete the todo
				if (todo === newTodo) {
					newTodo = undefined;
					dfd.resolve();
				} else {
					todo.destroy().then(function () {
						var todos = [].concat(list.get('todos'));
						todos.splice(todos.indexOf(todo), 1);
						list.save('todos', todos).then(function () {
							dfd.resolve();
						});
					});
				}
			} else {
				todo.staged.save().then(function () {
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
				delete todo.loading;
				updateTodos();
				updateLists();
				_finishedEditingTodo = todo;
			});
		};

		var update = function () {
			var list = state.selectedList,
				specialList = list.has('special') ? list.get('special')[0] : false,
				todos = _.chain(list.get('todos')).map(function (todo) {
					if (!todo.has('title')) { todo.set('title', ['Untitled todo']) }
					if (!todo.has('completed')) { todo.set('completed', [false]); }
					if (!todo.has('order')) { todo.set('order', [0]); }
					todo.off('change', updateTodos);
					todo.on('change', updateTodos);
					return todo;
				}).reject(function (todo) {
					return specialList === 'completed' ? !todo.get('completed')[0] : todo.get('completed')[0];
				}).value();
			console.log('!!!!!!', specialList)
			if (!specialList) {
				list.save('force-update-hack', Math.random()); // hack to force updates on other clients
			}
			if (newTodo) { todos.push(newTodo); }
			todos = _.sortBy(todos, function (todo) {
				return todo.get('order')[0];
			});
			_.each(todos, function (todo) {
				if (!todo.staged) { staged(todo); }
			});
			$scope.todos = todos;
			$update();
			updateLists();
		};
		var moveTodo = function (todo, newList) {
			var dfd1, dfd2,
				oldListTodos = [].concat(oldList.get('todos'));
			oldListTodos.splice(oldListTodos.indexOf(todo), 1);
			dfd1 = newList.save('todos', [todo].concat(newList.get('todos')));
			dfd2 = oldList.save('todos', oldListTodos).then();
			return $.when(dfd1, dfd2).then(function () {
				updateTodos();
			});
		};
		return {
			init: init,
			createBefore: createBefore
		}
	})
	.controller('todos', function ($scope, listsFactory, client, utils) {
		'use strict';

		var u = utils,
			state;


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


		// Wait until user is logged in and a box has been selected
		var init = function (b) {
			listsFactory.init(b);
			state = $scope.s = {};
			//$scope.box = b; // FIXME remove (just for console use)
		};


		listsFactory.on('update', function (lists, basicLists) {
			console.log('fired update', state.selectedList);
			$scope.lists = lists;
			$scope.normalLists = basicLists;
			state.isFirstList = $scope.lists.length === 0;
			if (!state.selectedList) { $scope.selectList($scope.lists[0]); }
			$update();
		});

		// todo - check box is defined (or put in init)
		$scope.createList = function () {
			listsFactory.create().then(function (list) {
				$scope.editList(list);
			});
		};

		$scope.editList = function (list) {
			state.editingList = list;
			$scope.closeListDropdown();
		};

		$scope.showListDropdown = function (list) {
			state.showingListDropdown = list;
		};
		$scope.closeListDropdown = function () {
			delete state.showingListDropdown;
		};
		$scope.toggleListDropdown = function (list) {
			if (state.showingListDropdown === list) {
				$scope.closeListDropdown(list);
			} else {
				$scope.showListDropdown(list);
			}
		};

		$scope.selectList = function (list) {
			if (list.isDeleting) { return; }
			console.log('selecting')
			if (state.selectedList) {
				state.selectedList.off('change:todos', updateTodos);
			}
			state.selectedList = list;
			updateTodos();
			list.on('change:todos', updateTodos);
		};

		$scope.deleteList = function (list) {
			if (state.selectedList === list) {
				delete state.selectedList;
			}
			listsFactory.remove(list);
		};

		$scope.cancelEditList = function () {
			if (!state.editingList) { return; }
			listsFactory.cancel(state.editingList)
			delete state.editingList;
		};

		$scope.saveList = function (list) {
			listsFactory.save(list).then(function () {
				delete state.editingList;
			}).always(function () {
				delete list.loading;
			});
		};

		$scope.countTodos = function (list) {
			return list.get('todos').length;
		};

		var $update = function () {
			console.log('$UPDATE')
			u.safeApply($scope);
		};

		$scope.bodyClick = function () {
			console.log(this)
			delete state.showingListDropdown;
		};



		// todo - check box is defined (or put in init)
		$scope.createTodoBefore = function (next) {
			todos.createBefore(next);
		};


		$scope.cancelEditTodo = function (todo) {
			console.log(todo);
			if (!todo) { return; }
			todo.staged.reset();
			newTodo = undefined;
			updateTodos();
		};

		$scope.saveTodo = function (todo) {
			todos.save(todo);
		};

		var _finishedEditingTodo;
		// hack to get todo text box to deselect after pressing enter
		$scope.finishedEditingTodo = function (todo) {
			var r = _finishedEditingTodo === todo;
			if (r) { _finishedEditingTodo = undefined; }
			return r;
		};

		var updateTodos = function () {
			
		};

		$scope.toggleTodoCompleted = function (todo) {
			todo.loading = true;
			todo.save('completed', [!todo.get('completed')[0]]).then(function () {
				todo.loading = false;
				updateTodos();
				updateLists();
			});
		};

		$scope.moveTodo = function (todo, oldList, newList) {
			
		};

		$(document)
			.keydown(function (e) {
				if (e.keyCode === 27) { //esc
					$('[sortable]')
						.sortable('cancel');
				}
			});

		window.$scope = $scope;


	}).directive('setFocus', function($timeout) {
		return {
			link: function ($scope, elem, attrs) {
				$scope.$watch(attrs.setFocus, function (value) {
					if (value === true) { 
						setTimeout(function () { elem[0].focus(); });
					}
				});
			}
		};
	}).directive('setBlur', function($timeout) {
		return {
			link: function ($scope, elem, attrs) {
				$scope.$watch(attrs.setBlur, function (value) {
					if (value === true) { 
						setTimeout(function () { elem[0].blur(); });
					}
				});
			}
		};
	}).directive('clickElsewhere', function($document){
		return {
			restrict: 'A',
			link: function (scope, elem, attr, ctrl) {
				elem.bind('click', function (e) {
					// this part keeps it from firing the click on the document.
					e.stopPropagation();
				});
				$document.bind('click', function() {
					// magic here.
					scope.$apply(attr.clickElsewhere);
				});
			}
		};
	}).directive('ngEscape', ['$parse', function($parse) {
		return function ($scope, elem, attr) {
			var fn = $parse(attr.ngEscape);
			elem.bind('keydown keypress', function (e) {
				if (e.keyCode === 27) {
					$scope.$apply(function() { fn($scope, {$event:e}); });
					setTimeout(function () { elem[0].blur(); });
					e.stopPropagation();
				}
			});
		}
	}]).directive('sortable', function (utils) {
		return {
			// A = attribute, E = Element, C = Class and M = HTML Comment
			restrict: 'A',
			link: function (scope, element, attrs) {
				var liAbove, liBelow;
				element.sortable({
					revert: true,
					handle: "[draggable-handle]",
					placeholder: 'todo-placeholder',
					tolerance: "pointer",
					start: function (ev, ui) {
						var height = ui.item.find('.todo-body').outerHeight(),
							tscope = angular.element(ui.item).scope();
						ui.placeholder.height(height);
						lastLiAbove = ui.placeholder.prev();
						ui.item.addClass('dragging');
						ui.item.one('mouseup', function () {
							ui.item.removeClass('dragging')
						});
					},
					change: function (ev, ui) {
						liBefore = ui.placeholder.prev('li.todo');
						liAfter = ui.placeholder.next('li.todo');
					},
					stop: function (ev, ui) {

						var tscope = angular.element(ui.item).scope(),
							todo = tscope.todo,
							todoBeforeScope = angular.element(liBefore).scope(),
							todoAfterScope = angular.element(liAfter).scope(),
							todoBeforeOrder, todoAfterOrder, order;

						if (todoBeforeScope) {
							todoBeforeOrder = todoBeforeScope.todo.get('order')[0];
						}
						if (todoAfterScope) {
							todoAfterOrder = todoAfterScope.todo.get('order')[0];
						}
						
						ui.item.removeClass('dragging').addClass('loading');

						if (todoAfterScope || todoBeforeScope) {
							if (todoAfterScope && todoBeforeScope) {
								order = todoBeforeOrder + (todoAfterOrder - todoBeforeOrder) / 2
							} else if (todoBeforeScope) {
								order = todoBeforeOrder + 1;
							} else {
								order = todoAfterOrder - 1;
							}
							todo.save({ order: [order] }).
								then(function () {
									ui.item.removeClass('loading');
								});
						}

					}
				}).disableSelection();
			}
		};
	}).directive('droppable', function () {
		return {
			// A = attribute, E = Element, C = Class and M = HTML Comment
			restrict: 'A',
			link: function ($scope, element) {
				element.droppable({
					hoverClass: 'dropping',
					tolerance: 'pointer',
					drop: function (ev, ui) {
						console.log('drop', ui);
						var el = ui.draggable,
							draggableScope = angular.element(el)
								.scope(),
							oldList = $scope.s.selectedList,
							newList = $scope.list,
							todo = draggableScope.todo;

						console.log('move', todo, oldList, newList)
						$scope.moveTodo(todo, oldList, newList);
					}
				});
			}
		};
	});;