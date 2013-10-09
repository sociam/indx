/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils, models) {
		'use strict';

		var box,
			u = utils;

		var initialize = function () {
			$scope.todo_lists = new models.TodoLists(undefined, {
				box: box,
				obj: box._create_model_for_id('todo_app'),
				array_key: 'todo_lists',
				save_selected: true
			});
			$scope.todo_lists
				.on('update change', function () {
					u.safe_apply($scope);
				})
				.on('edit_change', function (item) {
					console.log('edit change', item, $scope.editing_todo);
					if (item && $scope.editing_todo && $scope.editing_todo !== item) {
						$scope.editing_todo.restore();
					}
					$scope.editing_todo = item;
				})
				.fetch();
		};


		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function () {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box)
					.then(function (b) {
						box = b;
						initialize();
					})
					.fail(function (e) {
						u.error('error ', e);
					});
			}
		});

		$(document)
			.keydown(function (e) {
				if ($scope.editing_todo) {
					switch (e.keyCode) {
					case 27: //esc
						$scope.editing_todo.restore();
						$('textarea')
							.blur();
						break;
					case 13: // enter
						$scope.editing_todo.save_staged();
						e.preventDefault();
						$('textarea')
							.blur();
						break;
					case 38: // up
						e.preventDefault();
						focusTextarea(-1);
						break;
					case 40: // down
						focusTextarea(+1);
						e.preventDefault();
						break;
					}
				} else {
					switch (e.keyCode) {
					case 27: //esc
						$('[sortable]')
							.sortable('cancel');
						break;
					}
				}
			});

		var focusTextarea = function (n) {
			var $current = $('textarea:focus'),
				$currentli = $current.parents('li').last(),
				$nextli = n > 0 ? $currentli.next('li') : $currentli.prev('li'),
				$next = $nextli.find('textarea'),
				currentPos = $current.prop('selectionStart');
			$next.focus().prop({
				'selectionStart': currentPos,
				'selectionEnd': currentPos
			});
		};

		window.$scope = $scope;

		_.extend($scope, {
			todosFilter: function (todo) {
				var pass = true,
					completed = todo.get_attribute('completed'),
					just_completed = todo.just_completed,
					title = todo.get_attribute('title'),
					search_text = $scope.search_text || '';

				pass = pass && $scope.show_completed ? true : !(completed && !
					just_completed);
				pass = pass && (!$scope.search || title.toLowerCase()
					.indexOf(search_text.toLowerCase()) > -1);
				return pass;
			}
		});

		$scope.icons = ['facetime-video', 'gear', 'flag-checkered', 'phone', 'music', 'road',
			'magic', 'food', 'shield', 'rocket', 'suitcase', 'globe', 'gamepad', 'inbox',
			'glass', 'umbrella', 'magnet', 'picture', 'book', 'bookmark', 'group', 'bullhorn',
			'laptop', 'money', 'gift', 'bug', 'truck', 'calendar'];

		(function () { // le crazy importer


			var isObj = function (obj) {
				return (typeof obj === 'object') && obj.hasOwnProperty('@id');
			};

			var createObjArray = function (arr) {
				var promise = $.Deferred(),
					promises = [];
				arr.forEach(function (el, i) {
					if (isObj(el)) {
						var promise = $.Deferred();
						createObj(el).then(function (obj) {
							arr[i] = obj;
							promise.resolve();
						});
						promises.push(promise);
					}
				});
				$.when.apply(undefined, promises).then(function () {
					promise.resolve(arr);
				});
				return promise;
			};

			var createObj = function (attrs) {
				var promise = $.Deferred(),
					id = attrs['@id'];
				box.get_obj(id).then(function (obj) {
					console.log('create obj', obj.id, obj)
					var promises = [];
					Object.keys(attrs).forEach(function (k) {
						var v = attrs[k],
							promise;
						if (v instanceof Array) {
							promise = $.Deferred();
							createObjArray(v).then(function (arr) {
								attrs[k] = arr;
								promise.resolve();
							});
							promises.push(promise);
						} else if (isObj(v)) {
							promise = $.Deferred();
							createObj(v).then(function (nobj) {
								attrs[k] = nobj;
								promise.resolve();
							});
							promises.push(promise);
						}
					});
					$.when.apply(undefined, promises).then(function () {
						obj.save(attrs).then(function () {
							console.log('save obj', obj.id, obj)
							promise.resolve(obj);
						});
					});
				});
				return promise;
			};

			window.importJSON = function (json) {
				createObjArray(json);
			};

			window.exportJSON = function () {
				box.get_obj('todo_app').then(function (obj) {
					var json = obj.toJSON();
					json.todo_lists = _.map(json.todo_lists, function (todo_list) {
						var json = todo_list.toJSON();
						json.todos = _.map(json.todos, function (todos) {
							return todos.toJSON();
						});
						return json;
					})
					console.log(JSON.stringify(json, null, '\t'));
				});
			};
		}());

	})
	.directive('focusMe', function ($timeout, $parse) {
		return {
			//scope: true,   // optionally create a child scope
			link: function (scope, element, attrs) {
				var model = $parse(attrs.focusMe);
				scope.$watch(model, function (value) {
					console.log('value=', value);
					if (value === true) {
						$timeout(function () {
							element[0].focus();
						});
					}
				});
			}
		};
	})
	.directive('ngFocus', ['$parse',
		function ($parse) {
			return function (scope, element, attr) {
				var fn = $parse(attr['ngFocus']);
				element.bind('focus', function (event) {
					scope.$apply(function () {
						fn(scope, {
							$event: event
						});
					});
				});
			}
		}
	])
	.directive('sortable', function (utils) {
		return {
			// A = attribute, E = Element, C = Class and M = HTML Comment
			restrict: 'A',
			link: function (scope, element, attrs) {
				var lastLiAbove = undefined;
				element.sortable({
					revert: true,
					handle: "[draggable-handle]",
					placeholder: 'todo-placeholder',
					tolerance: "pointer",
					start: function (ev, ui) {
						var height = ui.item.find('.todo-body')
							.outerHeight() + 1,
							tscope = angular.element(ui.item)
								.scope();
						ui.placeholder.height(height);
						lastLiAbove = ui.placeholder.prev();
						tscope.todo.is_dragging = true;
					},
					change: function (ev, ui) {
						var liAbove = ui.placeholder.prev('li.todo-item'),
							liBelow = ui.placeholder.next('li.todo-item');
						if (lastLiAbove !== liAbove) {
							var clone = ui.placeholder.clone(),
								height = clone.height();
							$('.todo-placeholder.clone')
								.remove();
							lastLiAbove.after(clone);
							clone.addClass('animate clone')
								.height(0)
							ui.placeholder.removeClass('animate')
								.height(0);
							setTimeout(function () {
								ui.placeholder.addClass('animate')
									.height(height);
							});
							lastLiAbove = liAbove;
							if (liBelow.length) {
								var nextTodo = angular.element(liBelow)
									.scope()
									.todo,
									tscope = angular.element(ui.item)
										.scope(),
									draggingTodo = tscope.todo;
								draggingTodo.staged_attributes.urgency = nextTodo.get_attribute(
									'urgency');
								utils.safe_apply(tscope);
							}
						}
					},
					stop: function (ev, ui) {
						var tscope = angular.element(ui.item)
							.scope(),
							todo = tscope.todo,
							todos = scope.todo_lists.selected.todos,
							new_todos = element.find('li.todo-item')
								.map(function () {
									return angular.element(this)
										.scope()
										.todo;
								})
								.get();
						lastLiAbove = undefined;
						todo.is_dragging = false;
						todo.save_staged();
						todos.reset(new_todos)
							.save();
						utils.safe_apply(tscope);
						console.log(todos);
					}
				})
					.disableSelection();
			}
		};
	})
	.directive('droppable', function () {
		return {
			// A = attribute, E = Element, C = Class and M = HTML Comment
			restrict: 'A',
			link: function (scope, element) {
				element.droppable({
					hoverClass: 'dropping',
					tolerance: 'pointer',
					drop: function (ev, ui) {
						console.log('drop', ui);
						var el = ui.draggable,
							draggable_scope = angular.element(el)
								.scope(),
							old_todo_list = scope.todo_lists.selected.todos,
							new_todo_list = scope.todo_list.todos,
							todo = draggable_scope.todo;
						old_todo_list.move(todo, new_todo_list);
					}
				});
			}
		};
	});