/* global angular, $, console, _ */
angular
	.module('todos', ['ui', 'indx'])
	.controller('todos', function ($scope, client, utils, listcollection) {
		'use strict';


		var urgencies = ['low', 'med', 'high', 'urgent'],
			icons = ['video-camera', 'gear', 'flag-checkered', 'phone', 'music', 'road',
			'magic', 'cutlery', 'shield', 'rocket', 'suitcase', 'globe', 'gamepad', 'inbox',
			'glass', 'umbrella', 'magnet', 'picture-o', 'book', 'bookmark', 'group', 'bullhorn',
			'laptop', 'money', 'gift', 'bug', 'truck', 'calendar'];

		var u = utils,

			todoLists,
			todoListsView,
			todosView,

			editingTodoList;

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
				console.log('lists', todoLists.toJSON());
			});

			// Initialise and render the list of todo lists to be shown in the sidebar
			todoListsView = new TodoListsView({ todoLists: todoLists });
			$('.todos-sidebar').html('').append(todoListsView.el);

			var $iconslist = $('<div class="todo-list-icons"><div class="pointer"></div></div>');
			_(icons).each(function (icon) {
				var $icon = $('<a href="#"><i class="fa fa-' + icon + '"></i></a>')
					.click(function () {
						selectedIcon = icon;
						$(this).addClass('active').siblings().removeClass('active');
					});
				$iconslist.append($icon);
			});
			$('.todos-sidebar').append($iconslist.hide());


			// Initialise and render the list of todos
			//todosView = new TodosView({ todoLists: todoLists });
			//$('.todos-body').html('').append(todosView.el);

			$('.todos-main-body').show();

		};

		$(function () {
			initDlg();
		});
		var initDlg = function () {
			var $iconlist = $('.todo-list-icons'),
				selectedIcon;
			$('.new-todo-list-dlg')
				.find('.close-dlg').click(function () {
					$('.new-todo-list-dlg').fadeOut();
				}).end()
				.find('form').submit(function () {
					var title = $('.new-todo-list-dlg').find('.input-title').val(),
						promise;
					if (editingTodoList) {
						editingTodoList.set({ title: [title], icon: [selectedIcon] });
						promise = editingTodoList.save();
					} else {
						promise = todoLists.create({
							id: 'todo-list-' + u.uuid(),
							title: [title],
							icon: [selectedIcon]
						});
					}
					promise.then(function () {
						console.log('success saving/creating');
						$('.new-todo-list-dlg').fadeOut();
						// TODO select it
					}).fail(function () {
						console.error('some error occured');
						// TODO
					});
				});
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
			$('.todos-main-body').hide();
		};

		var editTodoList = function (todoList) {
			editingTodoList = todoList;
			$('.new-todo-list-dlg').show();
		};

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
				console.log('render lists');
				var that = this;
				that.$el.html('');
				this.todoLists.each(function (todoList) {
					var todoListView = new TodoListView({ todoList: todoList }); // FIXME: delete old views
					that.$el.append(todoListView.render().el);
				});
				var $newTodo = $('<li><div class="title">New todo list</div></li>');
				$newTodo.click(function () {
					editTodoList();
				});
				that.$el.append($newTodo);
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
				}).on('edit', function () {
					that.$el.addClass('editing')
						.find('input').removeAttr('disabled');
				}).on('editend', function () {
					that.$el.removeClass('editing')
						.find('input').attr('disabled', 'disabled');
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
						if (that.todoList.selected && !(that.todoList.get('special') &&
								that.todoList.get('special')[0])) {
							that.todoList.edit();
						}
						if (!that.todoList.selected) {
							that.todoList.select();
						}
					})
					.find('.icon').click(function () {
						var $icon = $(this),
							offset = $icon.offset();
						if (that.todoList.editing) {
							$('.todo-list-icons').show().css({
								top: offset.top + $icon.height() - 10,
								left: offset.left - 1
							});
						}
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
		};

		var TodosView = Backbone.View.extend({
			tagName: 'ul',
			initialize: function (options) {
				var that = this;
				this.todos = options.todos;
				console.log(this);
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
				var $newTodo = $('<li><div class="title text-muted">New todo</div></li>');
				that.$el.append($newTodo);
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
				if (this.get('special') && this.get('special')[0]) {
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
			edit: function (endedit) {
				console.log('edit', endedit)
				this.collection.setEditing(endedit ? undefined : this);
			},
			setSelected: function (selected) {
				if (this.selected !== selected) {
					this.selected = selected;
					this.trigger(selected ? 'select' : 'deselect');
				}
			},
			setEditing: function (editing) {
				if (this.editing !== editing) {
					this.editing = editing;
					this.trigger(editing ? 'edit' : 'editend');
				}
			},
			initTodos: function () {
				if (!this.id) { return; }
				var that = this,
					updateSpecial,
					specialType;
				if (this.get('special') && this.get('special')[0]) {
					this.todos = new Todos();
					specialType = this.get('special')[0];
					updateSpecial = function () {
						var allTodos = todoLists.reduce(function (todos, todoList) {
							var models;
							if (specialType === 'all') {
								models = todoList.todos.models;
							} else if (specialType === 'completed') {
								models = todoList.todos.filter(function (model) {
									return model.has('completed') && model.get('completed')[0] === true;
								});
							}
							return todos.concat(models);
						}, []);
						that.todos.reset(allTodos);
					};
					updateSpecial();
					todoLists.on('change', updateSpecial);
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
				options = _.extend({ save: true }, options);
				if (this.selected === todoList) { return; }
				this.selected = todoList;
				// Deselect others
				this.chain().filter(function (todoList) {
					return todoList.selected;
				}).each(function (todoList) {
					todoList.setSelected(false);
				});
				this.selected.setSelected(true);
				if (options.save) { this.obj.save('selected', [todoList]); }
				this.setEditing();
			},
			setEditing: function (todoList) {
				console.log('setedit', todoList)
				if (this.editing === todoList) { return; }
				this.editing = todoList;
				this.chain().filter(function (todoList) {
					return todoList.editing;
				}).each(function (todoList) {
					todoList.setEditing(false);
				});
				this.editing.setEditing(true);
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

			},
			close: function () {
				// todo
			}
		});

		var Todos = listcollection.Collection.extend({
			model: Todo
		});

	});