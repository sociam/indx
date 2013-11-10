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
				this.todoLists.on('reset', function () {
					that.render();
				});
			},
			render: function () {
				console.log('render lists')
				var that = this;
				that.$el.html('');
				this.todoLists.each(function (todoList) {
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
				var that = this;
				this.todoList = options.todoList;
				this.todoList.on('change', this.render, this);
				this.todoList.on('select', function () {
					that.$el.addClass('selected');
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
					}, listJSON));
				if (this.todoList.selected) {
					this.$el.addClass('selected');
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
				this.setSelected(true);
			},
			setSelected: function (selected) {
				this.selected = selected;
				this.trigger(selected ? 'select' : 'deselect');
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
				this.on('reset', function () {
					that.updateSelected();
					that.initSpecialLists();
				});
				this._obj.on('change:selected', function () {
					that.updateSelected();
				});
			},
			updateSelected: function () {
				var that = this,
					selected;
				if (this._obj.has('selected')) {
					var id = this._obj.get('selected')[0].id;
					selected = this.get(id);
				}
				if (!selected) { selected = this.at(0); }
				console.log('selected', this.at(0))
				if (!selected) { return; }
				this.selected = selected;
				this.chain().filter(function (todoList) {
					return todoList.selected && todoList !== that.selected;
				}).each(function (todoList) {
					todoList.setSelected(false);
				});
				this.selected.setSelected(true);
			},
			setSelected: function (todoList) {
				this._obj.save('selected', [todoList]);
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