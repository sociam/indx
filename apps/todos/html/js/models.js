/* global angular, _, confirm */
angular
	.module('todos')
	.factory('models', function (collection) {
		'use strict';

		var col = collection;

		var urgencies = ['low', 'med', 'high', 'urgent'];

		var TodoList = col.Model.extend({
			defaults: {
				title: 'Todo list'
			},
			initialize: function () {
				var that = this;
				this.todos = new TodoListItems(undefined, {
					box: this.box,
					obj: this,
					array_key: 'todos'
				});
				this.todos
					.on('update change', function () {
						that.trigger('update');
					})
					.on('edit_change', function (todo) {
						that.trigger('edit_change', todo);
					});
			},
			remove: function () {
				if (confirm('Are you sure you want to delete this todo list?')) {
					return col.Model.prototype.remove.apply(this, arguments);
				}
				return this;
			}
		});

		var TodoLists = col.Collection.extend({
			model: TodoList,
			model_id: function () {
				return 'todo-list-' + col.now();
			},
			model_options: {
				select: true
			}
		});

		var TodoListItem = col.Model.extend({
			defaults: {
				title: '',
				urgency: 'low',
				completed: false
			},
			toggle: function (new_state) {
				var that = this,
					old_state = this.get_attribute('completed');
				new_state = _.isUndefined(new_state) ? !old_state : new_state;
				if (new_state === old_state) {
					return;
				}
				clearTimeout(this.removal_timeout);
				if (new_state) {
					this.just_completed = true;
					this.undo = function () {
						this.save('completed', old_state);
						that.undo = undefined;
						that.just_completed = false;
						clearTimeout(this.removal_timeout);
					};
					this.removal_timeout = setTimeout(function () {
						that.undo = undefined;
						that.just_completed = false;
						that.trigger('change');
					}, 3300);
				} else {
					this.just_completed = false;
				}
				this.save('completed', new_state);
			},
			set_urgency: function (n) {
				var urgency = this.get_staged_attribute('urgency'),
					i = urgencies.indexOf(urgency);
					console.log('set_urgency', urgency)
				if (urgencies[i + n]) {
					this.staged_attributes.urgency = urgencies[i + n];
					//this.trigger('change');
				}
			},
			restore: function () {
				col.Model.prototype.restore.apply(this, arguments);
				//this.trigger('change');
			},
			remove: function () {
				if (confirm('Are you sure you want to delete this todo?')) {
					return col.Model.prototype.remove.apply(this, arguments);
				}
				return this;
			}
		});

		var TodoListItems = col.Collection.extend({
			model: TodoListItem,
			initialize: function () {
				var that = this;
				this.on('add_any', function (model) {
					model
						.on('edit', function () {
							that.trigger('edit_change', model);
						})
						.on('restore', function () {
							that.trigger('edit_change');
						});
				});
				col.Collection.prototype.initialize.apply(this, arguments);
			},
			model_id: function () {
				return 'todo-item-' + col.now();
			},
			comparator: function (m) {
				var urgency = m.is_editing ? m.get_staged_attribute('urgency') :
					m.get_attribute('urgency'),
					completed = m.get_attribute('completed') && !m.just_completed;
				return completed ? 100 : -urgencies.indexOf(urgency);
			}
		});

		return {
			TodoLists: TodoLists,
			TodoList: TodoList,
			TodoListItems: TodoListItems,
			TodoListItem: TodoListItem
		};
	});