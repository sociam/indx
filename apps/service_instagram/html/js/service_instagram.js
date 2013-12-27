angular
	.module('service_instagram', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;
		window.$s = $scope;

		$scope.app = {};

		var status = function(s) {
			sa(function() { $scope.status = s; });
		};


		$scope.get_instagram_access_token = function() {
			console.info('trying to run _get_instagram_access_token');
			var mywin = window.open($scope.access_token_url, '_blank', 'location=yes,height=570,width=520,scrollbars=yes,status=yes');

			// var tokenWindow = window;
			// tokenWindow.open($scope.access_token_url, '_blank', 'location=yes,height=570,width=520,scrollbars=yes,status=yes');
			// tokenWindow.onchange = function(){ myUnloadEvent(); }
			// var myUnloadEvent = function() {
   //  			console.info('You can have Ur Logic Here ,');
			// }
			var listener = function() {
  				//tokenWindowURL = tokenWindow.document.URL
  				console.info('New Window Has been Clicked');
			};
			mywin.addEventListener("onload", listener, false);
		};


		var _get_instagram_url_from_service = function() {
			console.info('trying to run _get_facebook_token_config_from_service')
			s._ajax('GET', 'apps/service_instagram/api/get_config').then(function(x) { 
				var config = x.config;
				console.info('Success in _get_instagram_url_from_service, got config of', config)
				// simple stuff
				sa(function() { 
					_($scope).extend({ 
						access_token_url:config.access_token_url,
						get_access_token_flag:true 
					});
				});
				//$scope.facebook_auth_status = "Long Token Authorised"
				var date = new Date();
				$scope.timestamp = date.toISOString();
				//console.info('Set new expiry time set: ', config.facebook_access_token_expire_time);
				//console.info('Set net token type: ', $scope.facebook_auth_status);
				console.info('Timestamp of new token: ', $scope.timestamp);
				//window.open($scope.access_token_url, '_blank', 'location=yes,height=570,width=520,scrollbars=yes,status=yes');	
				//_get_instagram_access_token()
				//get_instagram_access_token()
				// IG.login(function (response) {
				//     if (response.session) {
				//         // user is logged in
				//     }
				// }, {scope: ['comments', 'likes']});

			}).fail(function(err) { 
				console.error('could not get config ', err); 	
			});
		};

		var _get_config_from_service = function() {
			s._ajax('GET', 'apps/service_instagram/api/get_config').then(function(x) { 
				console.info('Twitter service got config from server: ',x.config);
				var config = x.config;
				console.info('Success in _get_config_from_service, got config of', config);

				// simple stuff
				sa(function() { 
					_($scope).extend({ 
						app: { 
							box : config.box,
							password: config.password,
						},
						consumer_key:config.consumer_key,
						consumer_secret:config.consumer_secret,
						access_token:config.access_token,
						access_token_secret:config.access_token_secret,
						instagram_username:config.instagram_username,
						instagram_search_words:config.instagram_search_words,
						instagram_status:config.instagram_status,
						instagram_network:config.instagram_network,
						start:config.start,
						step:config.step
					});
				});
				
				console.info('Got the config details for Twitter user:', $scope.instagram_username);

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

		$scope.InstagramLogin = function(){
			token_config = {'access_token_url:': ""}
			console.info('i got a request to get Instagram Access Token ', token_config);
			s._ajax('GET', 'apps/service_instagram/api/set_config', { 	config: JSON.stringify(token_config) }).then(function(x) { 
				console.info('trying to get the new config file, attempting to run new method');
				status('configuration chage committed');
				window.retval = x;
				_get_instagram_url_from_service();
			}).fail(function(e) {
				console.error(e);
				status('error committing change ' + e.toString());
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
			s._ajax('GET', 'apps/service_instagram/api/start').then(function(x) { 
				console.info('App doStart result: ', x); 
				status('Start command successful'); 
			}).fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.doStop = function() {
			console.log('App doStop');
			s._ajax('GET', 'apps/service_instagram/api/stop')
			.then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
			.fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			s._ajax('GET', 'apps/service_instagram/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
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
			s._ajax('GET','apps/service_instagram/api/is_running').then(function(r) { 
				sa(function() { 
					$scope.runstate = r.running ? 'Running' : 'Stopped';  
				});
			}).fail(function(r) {
				sa(function() { $scope.runstate = 'Unknown'; });
			});
		}, 1000);
	});
