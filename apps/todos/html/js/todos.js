/* global angular, $, console, _, Backbone */
angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils) {
		'use strict';

		var box,
			u = utils;


		var editable_item = {
				edit: function () {
					console.log('edit');
					this.newAttributes = _.clone(this.attributes);
					this._is_editing = true;
				},
				stage_and_save: function () {
					var that = this;
					this.save(this.newAttributes).then(function () {
						console.log('saved');
						that.restore();
						u.safe_apply($scope);
					});
				},
				restore: function () { this._is_editing = false; },
				is_editing: function () { return this._is_editing; },
				is_new: function () { return false; }
			},
			EditableList = Backbone.Collection.extend({
				item_prototype: editable_item,
				add: function (model) {
					var that = this;
					if (_.isArray(model)) {
						_.each(model, function (model) { that.add(model); });
					} else {
						_.extend(model, this.item_prototype);
						if (this.item_prototype.initialize) { this.item_prototype.initialize.apply(model); }
						return Backbone.Collection.prototype.add.apply(this, arguments);
					}
				}
			});


		var todo_list_prototype = _.extend({
				initialize: function () {
					var that = this;
					this.todos = new TodoListItems(this.get('todos'), { todo_list: this });
					that.update_todo_list();
					this.on('change:todos', function () {
						that.todos.reset(that.get('todos'));
						that.update_todo_list();
					});
					this.todos.on('add remove', function () {
						that.update_todo_list();
					});
					EditableList.prototype.initialize.apply(this, arguments);
				},
				create_todo: function (todo) {
					var that = this,
						promise = $.Deferred();
					this.fetch().then(function () {
						that.todos.add(todo);
						that.save('todos', that.todos.models).then(function () {
							that.update_todo_list();
							promise.resolve();
						});
					});
					return promise;
				},
				delete_todo: function (todo) {
					var that = this,
						promise = $.Deferred();
					console.log('delete todo');
					this.fetch().then(function () {
						that.todos.remove(todo);
						console.log('destroy obj');
						todo.destroy(function () {
							console.log('update list');
							that.save('todos', that.todos.models).then(function () {
								that.update_todo_list();
								promise.resolve();
							});
						});
					});
					return promise;
				},
				update_todo_list: function () {
					var that = this;
					this.todos_by_group = _.map(['For today', 'For another time'], function (group_title, i) {
						var today = i === 0 ? true : false,
							filtered_todos = that.todos.filter(function (todo) {
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
				},
				show: function () {
					console.log('show todo list ', this);
					$scope.curr_todo_list = this;
				},
				new_todo: function () {
					var that = this,
						id = 'todo-item-' + now(),
						todo = new Backbone.Model({ id: id });
					this.todos.add(todo); // placeholder
					_.extend(todo, {
						is_editing: function () { return true; },
						is_new: function () { return true; },
						stage_and_save: function () {
							this.set(this.newAttributes);
							console.log('creating todo');
							box.get_obj(id).then(function (new_todo) {
								new_todo.set({
									timestamp: now(),
									title: todo.get('title'),
									urgency: todo.get('urgency')
								});
								console.log('adding todo');
								that.todos.remove(todo); // remove placeholder
								that.create_todo(new_todo).then(function () {
									console.log('saving new todo', new_todo);
									new_todo.save().then(function () {
										console.log('created new todo', new_todo);
									});
								});
							});
						},
						restore: function () { that.todos.remove(todo); }
					});
				}
			}, editable_item),

			TodoLists = EditableList.extend({
				item_prototype: todo_list_prototype,
				fetch: function () {
					if (!box) { u.debug('no box, skipping '); return ;}
					var that = this,
						promise = $.Deferred();
					box.get_obj('todo_app').then(function (todo_app) {
						var todo_lists = todo_app.get('todo_lists') || [];
						that.reset(todo_lists);
						console.log('lists --> ', todo_lists);
						promise.resolve(that);
					});
					return promise;
				},
				save: function () {
					var that = this,
						promise = $.Deferred();
					box.get_obj('todo_app').then(function (todo_app) {
						console.log('trying to save todo lists = ', that.models);
						todo_app.save('todo_lists', that.models).then(function () {
							promise.resolve();
						});
					}).fail(function () { u.error('Could not create new todo list'); });
					return promise;
				}
			}),
			todo_lists = new TodoLists();


		var initialize = function () {
			todo_lists.fetch().then(function () {
				u.safe_apply($scope);
			});
		};


		var create_todo_list = function () {
			$scope.curr_todo_list = new Backbone.Model();
			_.extend($scope.curr_todo_list, {
				is_editing: function () { return true; },
				stage_and_save: function () {
					var that = this;
					this.set(this.newAttributes);
					box.get_obj('todo-list-' + now()).then(function (new_todo_list) {
						new_todo_list.set({
							timestamp: now(),
							title: that.get('title')
						});
						console.log('fetching todo lists');
						todo_lists.fetch().then(function () {
							console.log('add new todo list');
							todo_lists.add(new_todo_list);
							console.log('save new todo list');
							new_todo_list.save().then(function () {
								console.log('save lists');
								todo_lists.save().then(function () {
									$scope.curr_todo_list = new_todo_list;
									console.log('Created new todo list ' + new_todo_list.get('title'));
								}).fail(function () { u.error('Could now save todo lists '); });
							});
						});
					});
				},
				restore: function () { $scope.curr_todo_list = undefined; }
			});
		};


		var todo_list_item_prototype = _.extend({
				toggle: function () {
					this.save('completed', !pop(this.get('completed')));
				},
				remove: function () {
					console.log('wrtf', this, this.collection)
					this.collection.todo_list.delete_todo(this);
				}
			}, editable_item),
			TodoListItems = EditableList.extend({
				item_prototype: todo_list_item_prototype,
				initialize: function (models, options) {
					this.todo_list = options.todo_list;
					console.log('p', this.todo_list)
					EditableList.prototype.initialize.apply(this, arguments);
				}
			});


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

		var now = function () {
			return (new Date()).valueOf();
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
					initialize();
				}).fail(function(e) { u.error('error ', e); });
			}
		});

		_.extend($scope, {
			todo_lists: todo_lists,
			curr_todo_list: undefined,
			create_todo_list: create_todo_list,
			to_date_string: to_date_string,
			to_time_string: to_time_string,
			pop: pop,
			sorters: sorters,
			todo_sorter: { key: sorters[0].key, asc: true }
		});

	});
