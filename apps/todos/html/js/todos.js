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

					this.todos.on('update change', function () {
						u.safe_apply($scope);
					});
				},
				remove: function () {
					if (confirm('Are you sure you want to delete this todo list?')) {
						return collection.Model.prototype.remove.apply(this, arguments);
					}
					return this;
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
				initialize: function () {
					var that = this;
					this.on('edit', function () {
						if ($scope.editing_todo && $scope.editing_todo !== that) {
							$scope.editing_todo.restore();
						}
						$scope.editing_todo = that;
					});
					this.on('restore', function () { $scope.editing_todo = false; });
					collection.Model.prototype.initialize.apply(this, arguments);
				},
				toggle: function () {
					this.save('completed', !pop(this.get('completed')));
				},
				set_urgency: function (n) {
					var i = urgencies.indexOf(pop(this.newAttributes.urgency));
					if (urgencies[i + n]) {
						this.newAttributes.urgency = urgencies[i + n];
					}
				},
				remove: function () {
					if (confirm('Are you sure you want to delete this todo?')) {
						return collection.Model.prototype.remove.apply(this, arguments);
					}
					return this;
				}
			}),
			TodoListItems = collection.Collection.extend({
				model: TodoListItem,
				new_model: function () {
					var id = 'todo-item-' + collection.now();
					return collection.Collection.prototype.new_model.call(this,
						{ id: id });
				},
				comparator: function (m) {
					var urgency = pop(m.get('urgency')),
						completed = pop(m.get('completed'));
					return completed ? 100 : -urgencies.indexOf(urgency);
				}
			});


		var initialize = function () {
			console.log('init');
			$scope.todo_lists = new TodoLists(undefined, {
				box: box,
				obj: box._create_model_for_id('todo_app'),
				array_key: 'todo_lists',
				save_selected: true
			});
			$scope.todo_lists.fetch();
			$scope.todo_lists.on('update change', function () {
				console.log('fetched');
				u.safe_apply($scope);
			});
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

		var urgencies = [ 'low', 'med', 'high', 'urgent' ];

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
			todosFilter: function (todo) {
				var pass = true,
					completed = pop(todo.get('completed')),
					title = pop(todo.get('title')),
					search_text = $scope.search_text || '';

				pass = pass && $scope.show_completed ? true : !completed;
				pass = pass && (!$scope.search || title.toLowerCase().indexOf(search_text.toLowerCase()) > -1);
				return pass;
			}
		});

		$(document).keydown(function (e) {
			if ($scope.editing_todo) {
				switch (e.keyCode) {
				case 27: //esc
					$scope.editing_todo.restore();
					$('textarea').blur();
					break;
				case 13: // enter
					$scope.editing_todo.stage_and_save();
					e.preventDefault();
					$('textarea').blur();
					break;
				}
			}
		});

	}).directive('focusMe', function($timeout, $parse) {
	  return {
	    //scope: true,   // optionally create a child scope
	    link: function(scope, element, attrs) {
	      var model = $parse(attrs.focusMe);
	      scope.$watch(model, function(value) {
	        console.log('value=',value);
	        if(value === true) {
	          $timeout(function() {
	            element[0].focus();
	          });
	        }
	      });
	    }
	  };
	}).directive('ngFocus', ['$parse', function($parse) {
	  return function(scope, element, attr) {
	    var fn = $parse(attr['ngFocus']);
	    element.bind('focus', function(event) {
	      scope.$apply(function() {
	        fn(scope, {$event:event});
	      });
	    });
	  }
	}]);