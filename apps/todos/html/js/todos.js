/* global angular, $, console, _, Backbone */
angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils) {
		'use strict';

		var box,
			u = utils;

		var editable_item = {
				create: function () {
					var that = this;
					console.log('creating item');
					box.get_obj(this.id).then(function (new_obj) {
						console.log('new item');
						new_obj.save(that.newAttributes).then(function () {
							console.log('saved');
							that.trigger('created', new_obj);
						});
					});
					return this;
				},
				remove: function () { console.warn('remove: override this'); },
				edit: function (is_new) {
					console.log('edit');
					this.newAttributes = _.clone(this.attributes);
					this._is_new = is_new;
					this._is_editing = true;
					return this;
				},
				stage_and_save: function () {
					var that = this;
					console.log('stage and save');
					if (this.is_new()) {
						console.log('new, so create');
						return this.create();
					} else {
						this.save(this.newAttributes).then(function () {
							console.log('saved');
							that.restore();
							u.safe_apply($scope);
						});
					}
				},
				restore: function () {
					this._is_editing = false;
					this.trigger('restore');
				},
				is_editing: function () { return this._is_editing; },
				is_new: function () { return this._is_new; }
			},
			EditableList = Backbone.Collection.extend({
				item_prototype: editable_item,
				initialize: function (models) {
					var that = this;
					this.on('add', function () {
						console.log('add...');
						that.save();
					});
					this.on('add remove reset', function () {
						that.set_new_model(that._new_model);
					});
					console.log('this is should call first!');
					this.reset(models);
					this.set_new_model();
				},
				new_model: function (attributes) {
					var that = this,
						model = new Backbone.Model(attributes);
					this.extend_model(model);
					model
						.edit(true)
						.set({ timestamp: now() })
						.on('created', function (model) {
							console.log('going for the add');
							that.add(model);
							that.set_new_model();
						})
						.on('restore', function () {
							that.set_new_model();
						});
					console.log('new model',this._new_model, model);
					console.log('old', this.all_models.length);
					this.set_new_model(model);
					console.log('new', this.all_models.length);
					//this.reset(this.models); // TODO: ANGULAR GRR's
					return model;
				},
				set_new_model: function (model) {
					this._new_model = model;
					this.all_models = model ? this.models.concat([ model ]) : this.models;
					console.log('update!"!!!', this.models.length, this.all_models.length)
					this.trigger('update', this);
				},
				extend_model: function (model) {
					_.extend(model, this.item_prototype);
					if (this.item_prototype.initialize) {
						this.item_prototype.initialize.apply(model);
					}
					if (this.item_prototype.defaults) {
						_.defaults(model.attributes, this.item_prototype.defaults);
					}
				},
				add: function (model, options) {
					var that = this;
					if (_.isArray(model)) {
						_.each(model, function (model) { that.add(model, options); });
					} else {
						if (!_.isObject(model)) { console.error('There was a non-object stored??', model); return; }
						this.extend_model(model);
						return Backbone.Collection.prototype.add.apply(this, arguments);
					}
				},
				save: function () { console.log('save: override this'); }
			});

		var todo_list_prototype = _.extend({}, editable_item, {
				defaults: { title: 'Todo list' },
				initialize: function () {
					var that = this;
					console.log('curr todos', this.get('todos'));
					this.todos = new TodoListItems(this.get('todos'), { todo_list: this });
					that.update_todo_list();
					this.on('change:todos', function () {
						console.log('woah, stuff is changing!');
						that.todos.reset(that.get('todos'));
					});
					console.log('@DWS', this.todos.models.length, this.todos.all_models.length)
					this.todos.on('update change', function () {
						console.log('kk', that);
						that.update_todo_list();
					});
					this.todos.on('add', function (todo) {
						that.save_todo_list(todo);
					});
				},
				save_todo_list: function () {
					var that = this,
						promise = $.Deferred();
					console.log('save todo list');
					that.save('todos', that.todos.models).then(function () {
						that.update_todo_list();
						promise.resolve();
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
							filtered_todos = _(that.todos.all_models).filter(function (todo) {
								var t = pop(todo.get('today'));
								return today ? t === true : t !== true;
							});
						console.log('FILTERED TODOS', that.todos.all_models)
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
						todo = this.todos.new_model({ id: id });

					todo.on('restore', function () {
						if (todo.is_new()) { that.todos.remove(todo); }
					});
				},
				is_shown: function () {
					return $scope.curr_todo_list === this;
				}
			}),

			TodoLists = EditableList.extend({
				item_prototype: todo_list_prototype,
				fetch: function () {
					if (!box) { u.debug('no box, skipping '); return ;}
					var that = this,
						promise = $.Deferred();
					box.get_obj('todo_app').then(function (todo_app) {
						var todo_lists = todo_app.get('todo_lists') || [];
						that.reset(todo_lists);
						todo_app.on('change:todo_lists', function (todo_app, todo_lists) {
							console.log('updating lists -->', arguments);
							that.reset(todo_lists);
						});
						console.log('lists --> ', todo_lists);
						promise.resolve(that);
					});
					return promise;
				},
				save: function () {
					var that = this,
						promise = $.Deferred();
					console.log('save todo lists ...');
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

		var todo_list_item_prototype = _.extend({}, editable_item, {
				defaults: { title: '', urgency: 'low', completed: false },
				toggle: function () {
					this.save('completed', !pop(this.get('completed')));
				},
				remove: function () {
					console.log('wrtf', this, this.collection)
					this.collection.todo_list.delete_todo(this);
				}
			}),
			TodoListItems = EditableList.extend({
				item_prototype: todo_list_item_prototype,
				initialize: function (models, options) {
					this.todo_list = options.todo_list;
					console.log('p', this.todo_list)
					EditableList.prototype.initialize.apply(this, arguments);
				}
			});


		var initialize = function () {
			todo_lists.fetch().then(function () {
				u.safe_apply($scope);
			});
		};

		var create_todo_list = function () {
			var id = 'todo-list-' + now(),
				todo_list = todo_lists.new_model({ id: id });

			todo_list.on('restore', function () {
				if (todo_list.is_new()) { $scope.curr_todo_list = undefined; }
			}).on('created', function (todo_list) {
				$scope.curr_todo_list = todo_list;
			});

			$scope.curr_todo_list = todo_list;
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

		window.$scope = $scope;

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
