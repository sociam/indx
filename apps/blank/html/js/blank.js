angular
	.module('BlankApp', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;

		var status = function(s) {
			sa(function() { $scope.status = s; });
		};

		var load_box = function(bid) { 
			s.getBox(bid).then(function(box) {
				console.log('box ', box);
				window.box = box;

				// get the users
				s.getUserList().then(function(users) { 
					console.log('users >> ', users);
					sa(function() { 
						users.map(function(u) { 
							if (u.user_metadata && typeof u.user_metadata === 'string') {
								console.log('user metadata ', u.user_metadata, "---", typeof u.user_metadata);
								_(u).extend(JSON.parse(u.user_metadata));
							}
							if (!u.name) { u.name = u["@id"]; } 
						});
						$scope.users = users.filter(function(f) { return f.type.indexOf('local') >= 0; });
					});

				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting user list'; });
					console.error(e);
				});

				// get the users
				s.getBoxList().then(function(boxes) { 
					sa(function() { $scope.boxes = boxes; });
				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting box list'; });
					console.error(e);
				});
			});
		};
		$scope.grantACL = function(user,box) {
			console.log('grantacl -- ', user, box);
			s.getBox(box).then(function(b) { 
				console.log('got box ', b.id);
				b.setACL(user["@id"],{read:true,write:true}).then(function() {
					sa(function() { $scope.granted = true; $scope.granted_status = 'Success granting ' + user.name + " access to " + box; });
				}).fail(function(e) {
					sa(function() { $scope.granted = true; $scope.granted_status = 'Error setting ACL ' + e.toString(); });
				});
			});
		};

		$scope.doStart = function() {
			console.log('App doStart');
			s._ajax('GET', 'apps/blank/api/start').then(function(x) { 
				console.info('App doStart result: ', x); 
				status('Start command successful'); 
			}).fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.doStop = function() {
			console.log('App doStop');
			s._ajax('GET', 'apps/blank/api/stop')
			.then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
			.fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			s._ajax('GET', 'apps/blank/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
				console.log('success ', x);
				status('configuration chage committed');
				window.retval = x;
			}).fail(function(e) {
				console.error(e);
				status('error committing change ' + e.toString());
			});
		};

		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox);	
			}
		});

		setInterval(function() { 
			s._ajax('GET','apps/blank/api/is_running').then(function(r) { 
				sa(function() { 
					$scope.runstate = r.running ? 'Running' : 'Stopped';  
				});
			}).fail(function(r) {
				sa(function() { $scope.runstate = 'Unknown'; });
			});
		}, 1000);
	});
