/* global angular, $, console, _ */
angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils) {
		'use strict';

		var box,
			u = utils;

		$scope.loading = 0;

		var todos_sorted_by_time = function (todos) {
			todos = todos.concat([]); // clone
			todos.sort(function (x, y) {
				return y.get('timestamp')[0] - x.get('timestamp')[0];
			});
			return todos;
		};

		// utilities used by html5
		$scope.to_date_string = function (d) {
			return (new Date(d)).toDateString();
		};
		$scope.to_time_string = function (d) {
			return (new Date(d)).toLocaleTimeString();
		};

		// called by the refresh button
		$scope.create_todo = function() {
			$scope.loading++;
			$scope.error = undefined;
			var title = $('#todo_title').val();

			u.safe_apply($scope, function() {
				$scope.loading--;
				u.debug('todo >> ', title);
				u.safe_apply($scope, function() {
					$scope.add_todo({ title: title });
				});
			});
		};

		$scope.add_todo = function (todo) {
			console.log('add todo');
			if (!box) { u.debug('no box, skipping '); return ;}
			box.get_obj('my_todo_list').then(function (todo_list) {
				var now = (new Date()).valueOf(),
					todo_list_items = todos_sorted_by_time(todo_list.get('todos') || []);

				u.debug('minting new todo  >> ');
				// make new readin
				box.get_obj('my-todo-' + (new Date()).valueOf()).then(function (o) {
					console.log('todo ', todo);
					o.set({
						timestamp : now,
						title: todo.title,
						urgency: 'urgent'
					});
					todo_list_items.push(o);
					todo_list.set({'todos' : todo_list_items });
					o.save()
						.then(function() {
							console.log('todo list save >> !!!!!!!!!!!!!!!!!!!!! ');
							todo_list.save()
								.then(function () { u.debug('updated todo list' + todo_list_items.length); })
								.fail(function () { u.error('could not update todo list '); });
						}).fail(function(e) { u.error('could not create new todo ' + e); });
				});
			});
		};

		$scope.edit_todo = function (todo) {
			if ($scope.editing_todo) { $scope.editing_todo.editing = false; }
			$scope.editing_todo = todo;
			todo.newAttributes = _.clone(todo.attributes);
			if (todo.newAttributes.urgency.length) {
				todo.newAttributes.urgency = todo.newAttributes.urgency[0]; /// YEAHHHHHHH!!!!!
			}
			if ($scope.editing_todo) { $scope.editing_todo.editing = true; }
		};

		$scope.save_todo = function (todo) {
			todo.save(todo.newAttributes);
			$scope.edit_todo();
		};

		$scope.toggle_todo = function (todo) {
			todo.save('completed', !todo.get('completed') || !todo.get('completed')[0]);
		};

		var update_todo_list_view = function(todo_list) {
			var todos = set_defaults(todo_list.get('todos') || []),
				groups = _.map(['For today', 'For another time'], function (group_title, i) {
					var today = i === 0 ? true : false;
					return {
						title: group_title,
						by_time: _.select(todos_sorted_by_time(todos), function (todo) {
							return today ? todo.get('today') === true : todo.get('today') !== true;
						})
					};
				});

			console.log('update todo list view ');
			u.safe_apply($scope, function () {
				$scope.todo_groups = groups;
			});
		};

		var update_todo_list_watcher = function() {
			$scope.by_time = [];
			if (!box) { u.debug('no box, skipping '); return ;}
			box.get_obj('my_todo_list').then(function (todo_list) {
				console.log('todo list >> ', todo_list, todo_list.get('todos'));
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
				return todo;
			});
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

		window.s = client.store;


	});
