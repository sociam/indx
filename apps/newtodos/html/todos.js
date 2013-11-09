/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils, listcollection) {
		'use strict';


		var icons = ['facetime-video', 'gear', 'flag-checkered', 'phone', 'music', 'road',
			'magic', 'food', 'shield', 'rocket', 'suitcase', 'globe', 'gamepad', 'inbox',
			'glass', 'umbrella', 'magnet', 'picture', 'book', 'bookmark', 'group', 'bullhorn',
			'laptop', 'money', 'gift', 'bug', 'truck', 'calendar'];
		var urgencies = ['low', 'med', 'high', 'urgent'];


		var u = utils,

			todoLists,
			todoListsView,
			todosView;

		// Wait until user is logged in and a box has been selected
		var render = function (box) {
			console.log('init');
			destroy();

			todoLists = new TodoLists(undefined, {
				box: box,
				// Get the object placehold (FIXME: should not use a private method)
				obj: box._createModelForID('todoApp'),
				// Look for the following array within the obj
				arrayKey: 'todoLists'
			});

			window.todoLists = todoLists;

			// Get the todo lists
			todoLists.fetch().then(function () {
				console.log('lists', todoLists.toJSON())
			});

			// Initialise and render the list of todo lists to be shown in the sidebar
			todoListsView = new TodoListsView({ todoLists: todoLists });
			$('.todos-sidebar').html('').append(todoListsView.render().el);

			// Initialise and render the list of todos
			todosView = new TodosView({ todoLists: todoLists });
			$('.todos-body').html('').append(todosView.render().el);
		};

		// Destroy the current views (if there are any)
		var destroy = function () {
			if (todoLists) { todoLists.close(); }
			if (todoListsView) { todoListsView.close(); }
			if (todosView) { todosView.close(); }
		};


		// watches for login or box changes
		$scope.$watch('selectedBox + selectedUser', function () {
			if ($scope.selectedUser && $scope.selectedBox) {
				client.store.getBox($scope.selectedBox)
					.then(function (box) { render(box); })
					.fail(function (e) { u.error('error ', e); });
			} else {
				// TODO
			}
		});


		window.$scope = $scope;

		/** Define the views **/
		var TodoListsView = Backbone.View.extend({
			tagName: 'ul',
			initialize: function (options) {
				var that = this;
				this.todoLists = options.todoLists;
				this.todoLists.on('reset', function () {
					that.render();
				});
				this.specialTodoLists = [
					//new AllTodoList({ title: ['All todos'] }, { todoLists: this.todoLists }),
					//new CompletedTodoList({ title: ['Completed'] }, { todoLists: this.todoLists })
				]
			},
			render: function () {
				console.log('render lists')
				var that = this;
				that.$el.html('');
				var todoLists = this.todoLists.models.concat(this.specialTodoLists);
				_(todoLists).each(function (todoList) {
					var todoListView = new TodoListView({ todoList: todoList });
					that.$el.append(todoListView.render().$el);
				});
				return this;
			},
			close: function () {
				// TODO
			}
		});
		var TodoListView = Backbone.View.extend({
			tagName: 'li',
			template: _.template($('#template-todo-list').text()),
			initialize: function (options) {
				console.log('dh')
				this.todoList = options.todoList;
				this.todoList.on('change', this.render, this);
			},
			render: function () {
				var incompleteTodos = this.todoList.todos.filter(function (todo) {
						return !todo.get('completed') || todo.get('completed')[0] !== true;
					}),
					count = incompleteTodos.length,
					listJSON = this.todoList.toJSON(),
					html = this.template(_.extend({
						count: count
					}, listJSON));
				this.$el.html(html);
				console.log(this.template)
				return this;
			},
			close: function () {
				// TODO
			}
		});
		var TodosView = Backbone.View.extend({
			tagName: 'ul',
			initialize: function (options) {
				this.todoLists = options.todoLists;
			},
			render: function () {
				return this;
			},
			close: function () {
				// TODO
			}
		});
		var TodoView = Backbone.View.extend({
			tagName: 'li',
			initialize: function (options) {
				this.todo = options.todo;
			},
			render: function () {
				return this;
			},
			close: function () {
				// TODO
			}
		});

		/** Define the models **/
		var TodoList = listcollection.Model.extend({
			initialize: function () {
				var that = this;
				this.todos = new Todos(undefined, {
					box: this.box,
					obj: this,
					arrayKey: 'todos'
				});
				console.log('TODOS', this.todos.toJSON())
			},
			remove: function () {
				if (confirm('Are you sure you want to delete this todo list?')) {
					return col.Model.prototype.remove.apply(this, arguments);
				}
				return this;
			}
		});

		var SpecialTodoList = Backbone.Model.extend({
			defaults: {
				icon: ''
			},
			initialize: function (attrs, options) {
				var that = this;
				this.todoLists = options.todoLists;
				this.todos = new Todos();
				this.reset();
				this.todoLists.on('reset', function () {
					that.reset();
				});
			}
		})

		var AllTodoList = SpecialTodoList.extend({
			reset: function () {
				var models = _(this.todoLists.models).reduce(function (memo, todoList) {
					return memo.concat(todoList.todos);
				}, []);
				this.todos.reset(models);
			}
		});
		var CompletedTodoList = SpecialTodoList.extend({
			reset: function () {
				/*this.todos.reset(this.todoLists.reduce(function (memo, todoList) {
					return memo.concat(todoList.todos);
				}, []));*/
			}
		})

		var Todo = listcollection.Model.extend({});

		/** Define the collections **/

		var TodoLists = listcollection.Collection.extend({
			model: TodoList,
			// Make sure each todo list has a unique id
			modelId: function () { return 'todo-list-' + u.uuid(); },
			// Make todo lists selectable
			modelOptions: { select: true }
		});

		var Todos = listcollection.Collection.extend({
			model: Todo,
			modelId: function () { return 'todo-item-' + u.uuid(); },
			/*comparator: function (m) {
				var urgency = m.isEditing ? m.getStagedAttribute('urgency') :
					m.getAttribute('urgency'),
					completed = m.getAttribute('completed') && !m.justCompleted;
				return completed ? 100 : -urgencies.indexOf(urgency);
			}*/
		});

	});