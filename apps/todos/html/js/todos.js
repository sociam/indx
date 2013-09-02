/* global angular, $, console, _ */
angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils) {
		'use strict';

		var box,
			u = utils;


		// utilities used by html5
		var to_date_string = function (d) { return (new Date(d)).toDateString(); };
		var to_time_string = function (d) { return (new Date(d)).toLocaleTimeString(); };

		var create_todo = function() {
			var title = $('#todo_title').val();

			u.safe_apply($scope, function() {
				add_todo({ title: title }).then(function (todo) {
					u.safe_apply($scope, function() {
						edit_todo(todo);
					});
				});
			});
		};

		var get_todo_list = function () {
			var promise = $.Deferred();
			if (!box) { u.debug('no box, skipping '); return; }
			box.get_obj('my_todo_list').then(function (todo_list) {
				var todo_list_items = todo_list.get('todos') || [];
				promise.resolve(todo_list, todo_list_items);
			});
			return promise;
		};

		var add_todo = function (todo) {
			var promise = $.Deferred();
			console.log('add todo');

			get_todo_list().then(function (todo_list, todo_list_items) {
				todo_list_items = todos_sorted_by_time(todo_list_items);

				var now = (new Date()).valueOf();

				// make new todo
				box.get_obj('my-todo-' + now).then(function (o) {
					o.set({
						timestamp : now,
						title: todo.title,
						urgency: todo.urgency
					});
					todo_list_items.push(o);
					todo_list.set({ 'todos' : todo_list_items });
					$scope.new_todo = o;
					console.log('saving todo');
					o.save().then(function () {
						save_todo_list(todo_list, todo_list_items).then(function () {
							promise.resolve(o);
						});
					}).fail(function(e) { u.error('could not create new todo ' + e); });
				});
			});
			return promise;
		};

		var edit_todo = function (todo) {
			if (todo) {
				$scope.editing_todo = todo;
				todo.newAttributes = _.clone(todo.attributes);
				if (todo.newAttributes.urgency.length) {
					todo.newAttributes.urgency = todo.newAttributes.urgency[0]; /// YEAHHHHHHH!!!!!
				}
			} else {
				$scope.editing_todo = undefined;
			}
		};

		var save_todo_list = function (todo_list, todo_list_items) {
			var promise = $.Deferred();
			console.log('saving todo list');
			todo_list.save().then(function () {
				u.debug('updated todo list ' + todo_list_items.length);
				promise.resolve();
			}).fail(function () { u.error('could not update todo list '); });
			return promise;
		};

		var delete_todo = function (todo) {
			var promise = $.Deferred();
			console.log('delete todo');

			get_todo_list().then(function (todo_list, todo_list_items) {
				todo_list_items = todos_sorted_by_time(todo_list_items);
				todo_list_items = _.reject(todo_list_items, function (item) {
					console.log(item, todo)
					return item.id === todo.id;
				});

				todo.destroy().then(function () {
					save_todo_list(todo_list, todo_list_items).then(function () {
						promise.resolve();
					});
				});
			});
			return promise;
		};

		var is_editing = function (todo) {
			return $scope.editing_todo && todo.id === $scope.editing_todo.id;
		};

		var is_new = function (todo) {
			return $scope.new_todo && todo.id === $scope.new_todo.id;
		};

		var save_todo = function (todo) {
			todo.save(todo.newAttributes);
			$scope.edit_todo();
			$scope.new_todo = undefined;
		};

		var toggle_todo = function (todo) {
			todo.save('completed', !pop(todo.get('completed')));
		};

		var update_todo_list_view = function(todo_list) {
			var todos = set_defaults(todo_list.get('todos') || []),
				groups = _.map(['For today', 'For another time'], function (group_title, i) {
					var today = i === 0 ? true : false,
						filtered_todos = _.select(todos, function (todo) {
							var t = pop(todo.get('today'));
							return today ? t === true : t !== true;
						});
					return {
						title: group_title,
						todos: filtered_todos,
						sorted_by: get_sorted_todo_lists(filtered_todos)
					};
				});

			console.log('update todo list view ');
			u.safe_apply($scope, function () {
				$scope.todo_groups = groups;
			});
		};

		var update_todo_list_watcher = function() {
			if (!box) { u.debug('no box, skipping '); return ;}
			box.get_obj('my_todo_list').then(function (todo_list) {
				console.log('todo list >> ', todo_list.toJSON(), todo_list.get('todos'));
				todo_list.on('change', function() {
					console.log('todo list changed !! ');
					update_todo_list_view(todo_list);
				});
				update_todo_list_view(todo_list);
			});
		};

		var set_defaults = function (todos) {
			return _.map(todos, function (todo) {
				if (!todo.get('urgency')) { todo.set('urgency', 'low'); }
				//if (!todo.get('title')) { todo.set('title', ''); }
				return todo;
			});
		};

		var sorters = [
			{	key: 'priority',
				name: 'Priority',
				sort: function (todo) { return -priority_number(pop(todo.get('urgency'))); } },
			{	key: 'alphabetical',
				name: 'Alphabetical',
				sort: function (todo) { return pop(todo.get('title')); } },
			{	key: 'date',
				name: 'Date',
				sort: function (todo) { return pop(todo.get('timestamp')); } }
		];

		var get_sorted_todo_lists = function (todos) {
			var o = {};
			_.map(sorters, function (sorter) {
				o[sorter.key] = _.sortBy(todos, sorter.sort);
			});
			return o;
		};

		var todos_sorted_by_time = function (todos) {
			return _.sortBy(todos, function (todo) {
				if (is_new(todo)) { return -1; }
				return sorters[2].sort;
			});
		};

		var pop = function (arr) {
			if (!_.isArray(arr)) { return arr; }
			return _.first(arr);
		};

		var priority_number = function (priority) {
			return priority === 'done' ? -1 :
				priority === 'low' ? 0 :
				priority === 'med' ? 1 :
				priority === 'high' ? 2 : 3;
		};

		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
					update_todo_list_watcher();
				}).fail(function(e) { u.error('error ', e); });
			}
		});

		_.extend($scope, {
			to_date_string: to_date_string,
			to_time_string: to_time_string,
			create_todo: create_todo,
			add_todo: add_todo,
			edit_todo: edit_todo,
			save_todo: save_todo,
			delete_todo: delete_todo,
			toggle_todo: toggle_todo,
			editing_todo: undefined,
			new_todo: undefined,
			is_editing: is_editing,
			is_new: is_new,
			pop: pop,
			sorters: sorters,
			todo_sorter: { key: sorters[0].key, asc: true }
		});

	});
