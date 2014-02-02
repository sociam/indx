angular
	.module('service_facebook', ['ui','indx'])
	.run(function ($rootScope) {
	    window.fbAsyncInit = function () {
	        FB.init({
	            appId:'415327441930292',
	            status:true,
	            cookie:true,
	            xfbml:true
	        });
	        
	    };

	    (function (d) {
	        var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
	        if (d.getElementById(id)) {
	            return;
	        }
	        js = d.createElement('script');
	        js.id = id;
	        js.async = true;
	        js.src = "//connect.facebook.net/en_US/all.js";
	        ref.parentNode.insertBefore(js, ref);
	    }(document));
	})
	.controller('ConfigPage', function($scope, client, utils) {
		var s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;
		window.$s = $scope;

		$scope.facebook_auth_status = "Not Authorized"
		$scope.app = {};

		var status = function(s) {
			sa(function() { $scope.status = s; });
		};



		var _get_facebook_token_config_from_service = function() {
			console.info('trying to run _get_facebook_token_config_from_service')
			s._ajax('GET', 'apps/service_facebook/api/get_config').then(function(x) { 
				var config = JSON.parse(x.config);
				console.info('Success in get_facebook_token_config_from_service, got config of', config)
				// simple stuff
				sa(function() { 
					_($scope).extend({ 
						facebook_access_token_long:config.facebook_access_token_long,
						facebook_access_token_expire_time:config.facebook_access_token_expire_time
					});
				});
				$scope.facebook_auth_status = "Long Token Authorised"
				var date = new Date();
				$scope.timestamp = date.toISOString();
				console.info('Set new expiry time set: ', $scope.facebook_access_token_expire_time);
				console.info('Set new Long Token: ', $scope.facebook_access_token_long);
				console.info('Set net token type: ', $scope.facebook_auth_status);
				console.info('Timestamp of new token: ', $scope.timestamp);

			}).fail(function(err) { 
				console.error('could not get config ', err); 	
			});
		};

		var _get_config_from_service = function() {
			console.info('trying to run _get_config_from_service')
			s._ajax('GET', 'apps/service_facebook/api/get_config').then(function(x) { 
				var config = x.config;
				console.info('Success in _get_config_from_service, got config of', config)
				// simple stuff
				sa(function() { 
					_($scope).extend({ 
						app: { 
							box : config.box,
							password: config.password,
							address:config.address,
						},
						timestamp:config.config_timestamp,
						facebook_auth_status:config.facebook_auth_status,
						facebook_userid:config.facebook_userid,
						facebook_access_token:config.facebook_access_token,
						facebook_access_token_long:config.facebook_access_token_long,
						facebook_access_token_expire_time:config.facebook_access_token_expire_time,
						facebook_havest_timeline:config.facebook_havest_timeline,
						facebook_havest_network:config.facebook_havest_network
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


		var getLoginStatus = function () {
			var answer;
	        	 FB.getLoginStatus(function (response) {
	        	 	console.info('In getLoginStatus with a response of...', response);
	                answer = response;
	            });
	        return answer;
	      };

		$scope.FacebookLogin = function(){
	        response = getLoginStatus()
			console.info('In FacebookLogin with a first response of...', response);
	            switch (response.status) {
	                case 'connected':
	                    	//$scope.FacebookResponse(response)
	                   	console.info('i am connected to facebook fully', response);
	                   	$scope.facebook_auth_status = "Short Token Authorized"
	                    if($scope.setFacebookTokenDetails(response)){
	                    	if($scope.setConfig($scope.config)){
	                    		console.info('Trying to get long token now recieved and added short token config');
	                    		_get_facebook_token_config_from_service();
	                    	};
	                    };break;
	                    //need to get an extended token
                    case 'not_authorized':
                        FB.login(function (response) {
                            if (response.authResponse) {
								console.info('i am connected to facebook fully (after an unknown)', response);
								$scope.facebook_auth_status = "Short Token Authorized"
								if($scope.setFacebookTokenDetails(response)){
			                    	if($scope.setConfig($scope.config)){
			                    		console.info('Trying to get long token now recieved and added short token config');
			                    		_get_facebook_token_config_from_service();
			                    	};
			                    };
                            } else {
                                $rootScope.$broadcast('fb_login_failed');
                            }
                        },{scope: 'read_stream,read_mailbox,read_friendlists,publish_stream'})
                    case 'unknown':
                        FB.login(function (response) {
                            if (response.authResponse) {
								console.info('i am connected to facebook fully (after an unknown)', response);
								$scope.facebook_auth_status = "Short Token Authorized"
								if($scope.setFacebookTokenDetails(response)){
			                    	if($scope.setConfig($scope.config)){
			                    		console.info('Trying to get long token now recieved and added short token config');
			                    		_get_facebook_token_config_from_service();
			                    	};
			                    };
                            } else {
                                $rootScope.$broadcast('fb_login_failed');
                            }
                        },{scope: 'read_stream,read_mailbox,read_friendlists,publish_stream'});
                    default:
                        FB.login(function (response) {
                            if (response.authResponse) {
                                 $scope.setFacebookTokenDetails(response);
                            } else {
								console.info('login failed');
                            }
                        },{scope: 'read_stream,read_mailbox,read_friendlists,publish_stream'});
	                
	            };
	     };


	    $scope.setFacebookTokenDetails = function(details) {

	    	$scope.facebook_userid = details.authResponse.userID;
	    	$scope.facebook_access_token = details.authResponse.accessToken;
	    	$scope.facebook_access_token_expire_time = details.authResponse.expiresIn
			console.info('Facebook UserID set', $scope.facebook_userid );
			console.info('Facebook short Access_Token Received', $scope.facebook_access_token );
			console.info('Facebook short facebook_access_token_expire_time Received', $scope.facebook_access_token_expire_time );
	    	
	    	$scope.config = {'facebook_userid': $scope.facebook_userid, 'facebook_auth_status': $scope.facebook_auth_status, 'facebook_access_token': $scope.facebook_access_token}

			return true;
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
			s._ajax('GET', 'apps/service_facebook/api/start').then(function(x) { 
				console.info('App doStart result: ', x); 
				status('Start command successful'); 
			}).fail(function(x) { status(' Error ' + x.toString()); });
		};


		$scope.doStop = function() {
			console.log('App doStop');
			s._ajax('GET', 'apps/service_facebook/api/stop')
			.then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
			.fail(function(x) { status(' Error ' + x.toString()); });
		};

		$scope.setConfig = function(config) { 
			console.info('i got a config ', config);
			
			if(config['box']){
				//long token needs to be set first...
				if($scope.facebook_auth_status.indexOf("Long") >= 0){
					config['facebook_userid'] = $scope.facebook_userid;
					config['facebook_access_token_long'] = $scope.facebook_access_token_long;
					config['facebook_auth_status'] = $scope.facebook_auth_status;
					config['facebook_access_token_expire_time'] = $scope.facebook_access_token_expire_time;
					//add a datestamp
					config['config_timestamp'] = $scope.timestamp;
					console.info('Attempting to set full config: ', config);
				};
			};

			s._ajax('GET', 'apps/service_facebook/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
				console.log('success ', x);
				status('configuration chage committed');
				window.retval = x;
			}).fail(function(e) {
				console.error(e);
				status('error committing change ' + e.toString());
			});
			return true;
		};

		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox).then(function() {  
					_get_config_from_service();
				});
			}
		});

		setInterval(function() { 
			s._ajax('GET','apps/service_facebook/api/is_running').then(function(r) { 
				sa(function() { 
					$scope.runstate = r.running ? 'Running' : 'Stopped';  
				});
			}).fail(function(r) {
				sa(function() { $scope.runstate = 'Unknown'; });
			});
		}, 1000);
	});


