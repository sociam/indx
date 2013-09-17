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
				toggle: function (new_state) {
					var that = this,
						old_state = pop(this.get('completed'));
					new_state = _.isUndefined(new_state) ? !old_state : new_state;
					if (new_state === old_state) { return; }
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
							//u.safe_apply($scope);
						}, 3300);
					} else {
						this.just_completed = false;
					}
					this.save('completed', new_state);
				},
				set_urgency: function (n) {
					var i = urgencies.indexOf(pop(this.newAttributes.urgency));
					if (urgencies[i + n]) {
						this.newAttributes.urgency = urgencies[i + n];
						//this.trigger('change');
					}
				},
				restore: function () {
					collection.Model.prototype.restore.apply(this, arguments);
					//this.trigger('change');
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
					var urgency = m.is_editing ? pop(m.newAttributes.urgency) :
							pop(m.attributes.urgency),
						completed = pop(m.attributes.completed) && !m.just_completed;
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
					just_completed = todo.just_completed,
					title = pop(todo.get('title')),
					search_text = $scope.search_text || '';

				pass = pass && $scope.show_completed ? true : !(completed && !just_completed);
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
	}]).directive('draggable', function() {
    	return {
	        // A = attribute, E = Element, C = Class and M = HTML Comment
	        restrict:'A',
	        link: function(scope, element, attrs) {
	        	element.draggable({
			        revert:true,
			        handle: "[draggable-handle]"
			      });
	        }
		};
	}).directive('sortable', function(utils) {
    	return {
	        // A = attribute, E = Element, C = Class and M = HTML Comment
	        restrict:'A',
	        link: function(scope, element, attrs) {
	        	var lastLiAbove = undefined;
	        	element.sortable({
			        revert: true,
			        handle: "[draggable-handle]",
			        placeholder: 'todo-placeholder',
			        start: function (ev, ui) {
			        	var height = ui.item.find('.todo-body').outerHeight() + 1,
			        		tscope = angular.element(ui.item).scope();
			        	ui.placeholder.height(height);
			        	lastLiAbove = ui.placeholder.prev();
			        	tscope.todo.is_dragging = true;
			        },
			        change: function (ev, ui) {
			        	var liAbove = ui.placeholder.prev('li.todo-item'),
			        		liBelow = ui.placeholder.next('li.todo-item');
			        	if (lastLiAbove !== liAbove) {
			        		var clone = ui.placeholder.clone(),
			        			height = clone.height();
			        		$('.todo-placeholder.clone').remove();
			        		lastLiAbove.after(clone);
			        		clone.addClass('animate clone').height(0)
			        		ui.placeholder.removeClass('animate').height(0);
			        		setTimeout(function () {
			        			ui.placeholder.addClass('animate').height(height);
			        		});
			        		lastLiAbove = liAbove;
			        		if (liBelow.length) {
			        			var nextTodo = angular.element(liBelow).scope().todo,
			        				tscope = angular.element(ui.item).scope(),
			        				draggingTodo = tscope.todo;
			        			draggingTodo.newAttributes.urgency = pop(nextTodo.get('urgency'));
			        			utils.safe_apply(tscope);
			        		}
			        	}
			        },
			        stop: function (ev, ui) {
			        	var tscope = angular.element(ui.item).scope(),
			        		todo = tscope.todo,
			        		todos = scope.todo_lists.selected.todos,
			        		new_todos = element.find('li.todo-item').map(function () {
			        			return angular.element(this).scope().todo;
			        		}).get();
			        	lastLiAbove = undefined;
			        	todo.is_dragging = false;
			        	todo.stage_and_save();
			        	todos.reset(new_todos).save();
			        	utils.safe_apply(tscope);
			        	console.log(todos);
			        }
			      });
	        }
		};
	}).directive('droppable-above', function() {
    	return {
	        // A = attribute, E = Element, C = Class and M = HTML Comment
	        restrict:'A',
	        link: function(scope, element, attrs) {
	        	element.draggable({
			        revert:true,
			        handle: "[draggable-handle]"
			      });
	        }
		};
	});


		var pop = function (arr) {
			if (!_.isArray(arr)) { return arr; }
			return _.first(arr);
		};