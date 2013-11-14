angular
	.module('service_twitter', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;
		window.$s = $scope;

		$scope.app = {};

		var status = function(s) {
			sa(function() { $scope.status = s; });
		};

		var _get_config_from_service = function() {
			s._ajax('GET', 'apps/service_twitter/api/get_config').then(function(x) { 
				var config = JSON.parse(x.config);

				// simple stuff
				sa(function() { 
					_($scope).extend({ 
						app: { 
							box : config.box,
							password: config.password,
						},
						start:config.start,
						step:config.step,
						frequency:config.frequency
					});
				});

				// restore the user
				if (config.user && $scope.users) { 
					var match = $scope.users.filter(function(u) { return u['@id'] === config.user; });
					if (match.length) {
						console.log('match ', match[0]);
						window.match = match[0];
						sa(function() { $scope.app.user = match[0]; });
					}
				}

			}).fail(function(err) { 
				console.error('could not get config ', err); 	
			});
		};

		var load_box = function(bid) { 
			var dul = u.deferred(), dbl = u.deferred();
			s.getBox(bid).then(function(box) {
				// get the users
				s.getUserList().then(function(users) {
					console.log('users >> ', users);
					window.users = users;
					sa(function() { $scope.users = users.filter(function(f) { return f.type.indexOf('local') >= 0; });	});
					dul.resolve();
				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting user list'; });
					console.error(e);
					dul.reject();
				});

				// get the users
				s.getBoxList().then(function(boxes) { 
					sa(function() { $scope.boxes = boxes; });
					dbl.resolve();
				}).fail(function(e) {
					sa(function() { $scope.status = 'error getting box list'; });
					console.error(e);
					dbl.reject();
				});
			});
			return u.when([dul, dbl]);
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
			s._ajax('GET', 'apps/service_twitter/api/start').then(function(x) { 
				console.info('App doStart result: ', x); 
				status('Start command successful'); 
			}).fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.doStop = function() {
			console.log('App doStop');
			s._ajax('GET', 'apps/service_twitter/api/stop')
			.then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
			.fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			s._ajax('GET', 'apps/service_twitter/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
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
				load_box($scope.selectedBox).then(function() {  
					_get_config_from_service();
				});
			}
		});

		setInterval(function() { 
			s._ajax('GET','apps/service_twitter/api/is_running').then(function(r) { 
				sa(function() { 
					$scope.runstate = r.running ? 'Running' : 'Stopped';  
				});
			}).fail(function(r) {
				sa(function() { $scope.runstate = 'Unknown'; });
			});
		}, 1000);
	});
