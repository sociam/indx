/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils, listcollection) {
		'use strict';


		var urgencies = ['low', 'med', 'high', 'urgent'],
			icons = ['facetime-video', 'gear', 'flag-checkered', 'phone', 'music', 'road',
			'magic', 'food', 'shield', 'rocket', 'suitcase', 'globe', 'gamepad', 'inbox',
			'glass', 'umbrella', 'magnet', 'picture', 'book', 'bookmark', 'group', 'bullhorn',
			'laptop', 'money', 'gift', 'bug', 'truck', 'calendar'];

		var u = utils,

			todoLists,
			todoListsView,
			todosView;

		// Wait until user is logged in and a box has been selected
		var render = function (box) {
			console.log('init');

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
			$('.todos-sidebar').html('').append(todoListsView.el);

			// Initialise and render the list of todos
			todosView = new TodosView({ todoLists: todoLists });
			$('.todos-body').html('').append(todosView.el);
		};

		// Destroy the current views (if there are any)
		var destroy = function () {
			if (todoLists) { todoLists.close(); }
			if (todoListsView) { todoListsView.close(); }
			if (todosView) { todosView.close(); }
			$('.todos-messages').hide().html('');
		};

		var showMessage = function (msg) {
			$('.todos-messages').show().html(msg);
		}
		// watches for login or box changes
		$scope.$watch('selectedBox + selectedUser', function () {
			destroy();
			if ($scope.selectedUser && $scope.selectedBox) {
				client.store.getBox($scope.selectedBox)
					.then(function (box) { render(box); })
					.fail(function (e) { u.error('error ', e); showMessage('An error occured.') });
			} else {
				if (!$scope.selectedBox) {
					showMessage('Please select a box.');
				}
				if (!$scope.selectedUser) {
					showMessage('Please log in.');
				}
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
				this.todoLists.on('reset add remove', function () { // FIXME
					that.render();
				});
			},
			render: function () {
				console.log('render lists')
				var that = this;
				that.$el.html('');
				this.todoLists.each(function (todoList) {
					var todoListView = new TodoListView({ todoList: todoList }); // FIXME: delete old views
					that.$el.append(todoListView.render().el);
				});
				that.$el.append('<li><div class="title">New todo list</div></li>');
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
				var that = this;
				this.todoList = options.todoList;
				this.todoList.on('change', this.render, this);
				this.todoList.on('select', function () {
					that.$el.addClass('selected');
					renderTodos(that.todoList.todos);
				}).on('deselect', function () {
					that.$el.removeClass('selected');
				});
			},
			render: function () {
				var that = this,
					incompleteTodos = this.todoList.todos.filter(function (todo) {
						return !todo.get('completed') || todo.get('completed')[0] !== true;
					}),
					count = incompleteTodos.length,
					listJSON = this.todoList.toJSON(),
					html = this.template(_.extend({
						count: count
					}, listJSON)),
					special = this.todoList.get('special');
				if (this.todoList.selected) {
					this.$el.addClass('selected');
				}
				if (special && special[0]) {
					this.$el.addClass('special special-' + special[0]);
				}
				this.$el
					.html(html)
					.click(function () {
						that.todoList.select();
					});
				return this;
			},
			close: function () {
				// TODO
			}
		});

		var renderTodos = function (todos) {
			var currentTodosView = new TodosView({ todos: todos });
			currentTodosView.close();
			$('.todos-body').html('').append(currentTodosView.render().el);
		}
		var TodosView = Backbone.View.extend({
			tagName: 'ul',
			initialize: function (options) {
				var that = this;
				this.todos = options.todos;
				this.todos.on('reset add remove', function () { // FIXME
					that.render();
				});
			},
			render: function () {
				var that = this;
				console.log('render todos');
				that.$el.html('');
				this.todos.each(function (todo) {
					var todoView = new TodoView({ todo: todo }); // FIXME: delete old views
					that.$el.append(todoView.render().el);
				});
				return this;
			},
			close: function () {
				this.$el.remove();
				this.off();
				// TODO
			}
		});
		var TodoView = Backbone.View.extend({
			tagName: 'li',
			template: _.template($('#template-todo').text()),
			initialize: function (options) {
				this.todo = options.todo;
				this.todo.on('change', this.render, this);
			},
			render: function () {
				var todoJSON = this.todo.toJSON(),
					html = this.template(_.extend({

					}, todoJSON));

				this.$el
					.html(html)
				return this;
			},
			close: function () {
				// TODO
			}
		});

		/** Define the models **/
		var TodoList = listcollection.Model.extend({
			defaults: {
				'selected': [false],
				'title': [''],
				'icon': [''],
				'special': []
			},
			initialize: function () {
				var that = this;
				this.initTodos();
				console.log('TODOS', this.todos.toJSON())
				if (this.has('special')) {
					this.collection.on('reset', function () {
						that.initTodos();
					});
				}
			},
			remove: function () {
				if (confirm('Are you sure you want to delete this todo list?')) {
					return col.Model.prototype.remove.apply(this, arguments);
				}
				return this;
			},
			select: function () {
				this.collection.setSelected(this);
			},
			setSelected: function (selected) {
				if (this.selected !== selected) {
					this.selected = selected;
					this.trigger(selected ? 'select' : 'deselect');
				}
			},
			initTodos: function () {
				if (this.has('special')) {
					this.todos = new Todos();
				} else {
					this.todos = new Todos(undefined, {
						box: this.box,
						obj: this,
						arrayKey: 'todos'
					});
				}
			}
		});

		var Todo = listcollection.Model.extend({});

		/** Define the collections **/

		var TodoLists = listcollection.Collection.extend({
			model: TodoList,
			initialize: function () {
				listcollection.Collection.prototype.initialize.apply(this, arguments); // FIXME
				var that = this;
				this.on('change', function () {
					that.initSpecialLists();
					that.initSelected();
				});
			},
			initSelected: function () {
				if (!this.selected) {
					var selected;
					if (this.obj.has('selected')) {
						var id = this.obj.get('selected')[0].id;
						selected = this.get(id);
					}
					if (!selected) { selected = this.at(0); }
					console.log('selected', this.at(0))
					if (!selected) { return; }
					this.setSelected(selected, { save: false });
				}
			},
			setSelected: function (todoList, options) {
				var that = this;
				options = _.extend({ save: true }, options);
				if (this.selected !== todoList) {
					this.selected = todoList;
					// Deselect others
					this.chain().filter(function (todoList) {
						return todoList.selected && todoList !== that.selected;
					}).each(function (todoList) {
						todoList.setSelected(false);
					});
					this.selected.setSelected(true);
					if (options.save) { this.obj.save('selected', [todoList]); }
				}
			},
			initSpecialLists: function () {
				var that = this;
				var specialLists = [
					{ id: 'todo-list-all', title: ['All todos'], special: ['all'] },
					{ id: 'todo-list-completed', title: ['Completed'], special: ['completed'] }
				];

				_.each(specialLists, function (o) {
					var specialList = that.find(function (todoList) {
						return todoList.get('special')[0] === o.special[0];
					});
					if (!specialList) {
						console.log('create', o)
						that.create(o);
					}
				});

			}
		});

		var Todos = listcollection.Collection.extend({
			model: Todo
		});

	});