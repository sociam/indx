/* global angular, $, console, _, Backbone */
angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils, collection) {
		'use strict';

		var box,
			u = utils;

		var TodoList = collection.Model.extend({
				defaults: { title: 'Todo list' },
				initialize: function () {
					var that = this;

					this.todos = new TodoListItems(undefined, {
						box: box,
						obj: this,
						array_key: 'todos'
					});

					that.update_todo_list();

					this.todos.on('update change', function () {
						that.update_todo_list();
					});
				},
				update_todo_list: function () {
					var that = this;
					this.todos_by_group = _.map(['For today', 'For another time'], function (group_title, i) {
						var today = i === 0 ? true : false,
							filtered_todos = _(that.todos.all_models).filter(function (todo) {
								var t = pop(todo.get('today'));
								return today ? t === true : t !== true;
							});
						return {
							title: group_title,
							todos: filtered_todos,
							sorted_by: get_sorted_todo_lists(filtered_todos)
						};
					});
					console.log('todos, ', that.todos_by_group);
					u.safe_apply($scope);
				}
			}),

			TodoLists = collection.Collection.extend({
				model: TodoList,
				new_model: function () {
					var id = 'todo-list-' + collection.now();
					return collection.Collection.prototype.new_model.call(this,
						{ id: id }, { select: true });
				}
			});

		var TodoListItem = collection.Model.extend({
				defaults: { title: '', urgency: 'low', completed: false },
				toggle: function () {
					this.save('completed', !pop(this.get('completed')));
				},
				/*remove: function () {
					console.log('wrtf', this, this.collection)
					this.collection.todo_list.delete_todo(this);
				}*/
			}),
			TodoListItems = collection.Collection.extend({
				model: TodoListItem,
				new_model: function () {
					var id = 'todo-item-' + collection.now();
					return collection.Collection.prototype.new_model.call(this,
						{ id: id });
				}
			});


		var initialize = function () {
			console.log('init');
			$scope.todo_lists = new TodoLists(undefined, {
				box: box,
				obj: box._create_model_for_id('todo_app'),
				array_key: 'todo_lists',
				saveSelected: true
			});
			$scope.todo_lists.fetch();
			$scope.todo_lists.on('update change', function () {
				//console.log('fetched');
				u.safe_apply($scope);
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


		// utilities used by html5
		var to_date_string = function (d) { return (new Date(d)).toDateString(); };
		var to_time_string = function (d) { return (new Date(d)).toLocaleTimeString(); };


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
					initialize();
				}).fail(function(e) { u.error('error ', e); });
			}
		});

		window.$scope = $scope;

		_.extend($scope, {
			to_date_string: to_date_string,
			to_time_string: to_time_string,
			pop: pop,
			sorters: sorters,
			todo_sorter: { key: sorters[0].key, asc: true }
		});

	});
