angular
	.module('todos', ['ui','indx'])
	.controller('todos', function($scope, client, utils) {

		var box, u = utils, s = client.store;
		$scope.loading = 0;

		var initialise = function() {
		};

		var todos_sorted_by_time = function (todos) {
			todos = todos.concat([]); // clone
			todos.sort(function (x, y) {
				return y.get('timestamp')[0] - x.get('timestamp')[0];
			});
			return todos;
		};

		// utilities used by html5
		$scope.to_date_string = function (d) {
			// console.log('to date string ', d, typeof(d));
			return (new Date(d)).toDateString();
		};
		$scope.to_time_string = function (d) {
			// console.log('to time string ', d, typeof(d));
			return (new Date(d)).toLocaleTimeString();
		};

		// called by the refresh button
		$scope.create_todo = function() {
			$scope.loading++;
			$scope.error = undefined;
			var title = $('#todo_title').val();

			u.safe_apply($scope, function() {
				$scope.loading--;
				u.debug("todo >> ", title);
				u.safe_apply($scope, function() {
					$scope.add_todo({ title: title });
				});
			});
		};

		$scope.add_todo = function (todo) {
			console.log('add todo');
			if (!box) { u.debug('no box, skipping '); return ;}
			box.get_obj('my_todo_list').then(function (todo_list) {
				var now = (new Date()).valueOf(),
					todo_list_items = todos_sorted_by_time(todo_list.get('todos') || []);

				console.log("MY TODO LIST ", todo_list_items.length, todo_list);

				u.debug('minting new todo  >> ');
				// make new readin
				box.get_obj('my-todo-' + (new Date()).valueOf()).then(function (o) {
					console.log('todo ', todo);
					o.set({
						timestamp : now,
						title: todo.title
					});
					todo_list_items.push(o);
					todo_list.set({'todos' : todo_list_items });
					o.save()
						.then(function() {
							console.log('todo list save >> !!!!!!!!!!!!!!!!!!!!! ');
							todo_list.save()
								.then(function(h) { u.debug('updated todo list' + todo_list_items.length); })
								.fail(function(e) { u.error('could not update todo list '); });
						}).fail(function(e) { u.error('could not create new todo ' + e); });
				});
			});
		};

		$scope.by_time = [];

		var top_of_day = function(dlong) {
			var dd = (new Date(dlong)).toDateString();
			return new Date(dd).valueOf();
		};
		var update_todo_list_view = function(todo_list) {
			var by_time = todos_sorted_by_time(todo_list.get('todos') || []);
			console.log('update todo list view >> ', by_time.length);
			u.safe_apply($scope, function () {
				$scope.by_time = _.map(by_time, function (todo) {
					return todo.toJSON();
				});
				console.log(' >>>> by time is ', by_time);
			});
		};
		var update_todo_list_watcher = function() {
			$scope.by_time = [];
			if (!box) { u.debug('no box, skipping '); return ;}
			console.log("UPDATE TODO LIST WATCHER >> ");
			box.get_obj('my_todo_list').then(function (todo_list) {
				console.log('todo list >> ', todo_list, todo_list.get('todos'));
				todo_list.on('change', function() {
					console.log('todo list changed !! ');
					update_todo_list_view(todo_list);
				});
				update_todo_list_view(todo_list);
			});
		};
		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
					update_todo_list_watcher();
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		initialise();
		window.s = client.store;
	});
