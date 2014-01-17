angular
	.module('MovesConnector', ['ui','indx'])
	.controller('ConfigPage', function($scope, client, utils) {
		var u = utils, s = client.store, sa = function(f) { utils.safeApply($scope, f); };
		window.store = client.store;
		window.$s = $scope;
		$scope.app = {};
		var status = function(s) {	sa(function() { $scope.status = s; });	};
		$scope.redirect_url = [store._getBaseURL(), "apps", "moves", "moves_redirect.html"].join('/');

		// this pops up a new window which prompts the user to
		// put a special code into their moves app to authorise
		// access.
		var open_moves_authorise = function(clientid) {
			var redirect_url = encodeURIComponent($scope.redirect_url);
			var url = 'https://api.moves-app.com/oauth/v1/authorize?response_type=code&client_id='+clientid+'&redirect_uri='+redirect_url+"&scope=activity%20location";
			var popup = window.open(url, 'indx_moves_popup', 'width=790,height=500');
			var d = u.deferred();
			window._moves_continuation = function(response) {
				console.info("moves continuation >> ", response);
				var getparam = function(pname) { return u.getParameterByName(pname, '?'+response); };
				var code = getparam('code');
				console.log('got code -- ', code);
				d.resolve(code);
			};
			var intPopupChecker = setInterval(function() {
					if (!popup.closed) { return; }
					if (d.state() !== 'pending') {
						// success/failure has been achieved, just continue
						// console.info('popup closed naturally, continuing');
						clearInterval(intPopupChecker);
						return;
					}
					// console.error('popup force closed, continuing reject');
					// popup force closed
					clearInterval(intPopupChecker);
					d.reject({status:0, message:"Attempt Cancelled"});
				});
			return d.promise();
		};

		$scope.clearAuthCode = function() {
			sa(function() { 
				delete $scope.authcode;
				$scope.setConfig($scope.config);
			});
		};
		$scope.getAuthCode = function() {
			open_moves_authorise($scope.clientid).then(function(code) { 
				sa(function() {
					status("Successfully got auth code " + code + " from moves, saving.");
					$scope.authcode = code;
					$scope.setConfigFromScope();
				});
			}).fail(function(err) { 
				status('Error getting auth code from Moves - ' + err.message);
			});
		};
		// getting and setting from server ==================================================
		// @get_config
		var getConfig = function() {
			s._ajax('GET', 'apps/moves/api/get_config').then(function(x) { 
				console.info(' got config >> ', x);
				var config = x.config;
				// simple stuff
				// restore the user
				if (config.user && $scope.users) { 
					var match = $scope.users.filter(function(u) { return u['@id'] === config.user; });
					if (match.length) {
						window.match = match[0];
						config.user = match[0]; 
					}
				}
				sa(function() { $scope.config = config;	});				
			}).fail(function(err) { console.error('could not get config ', err); });
		};
		// @setConfig
		$scope.setConfig = function(config) { 
			console.info('xmitting config to server >> ', config);
			var c = _(config).clone();

			// strip out objects (user object namely)
			_(config).map(function(v,k) {
				if (_(v).isObject() && v['@id']) { 
					console.log('v object > ', v);
					config[k] = v['@id'];
				}
			});
			s._ajax('GET', 'apps/moves/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
				status('configuration chage committed');
				window.retval = x;
			}).fail(function(e) {
				console.error(e);
				status('error committing change ' + e.toString());
			});
		};

		// $scope.setConfigFromScope = function() {
		// 	$scope.setConfig({
		// 		latlngs:$scope.latlngs,
		// 		sleep:$scope.sleep,
		// 		box:$scope.app.box,
		// 		user:$scope.app.user && $scope.app.user['@id'],
		// 		password:$scope.app.password,
		// 		clientid:$scope.clientid,
		// 		clientsecret:$scope.clientsecret,
		// 		authcode:$scope.authcode
		// 	});
		// };



		var load_box = function(bid) { 
			var dul = u.deferred(), dbl = u.deferred();
			s.getBox(bid).then(function(box) {
				// get the users
				s.getUserList().then(function(users) {
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
			s._ajax('GET', 'apps/moves/api/start').then(function(x) { 
				console.info('App doStart result: ', x); 
				status('Start command successful'); 
			}).fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.doStop = function() {
			console.log('App doStop');
			s._ajax('GET', 'apps/moves/api/stop')
				.then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
				.fail(function(x) { status(' Error ' + x.toString()); });
		};
		$scope.$watch('selectedUser + selectedBox', function() { 
			if ($scope.selectedBox) {
				load_box($scope.selectedBox).then(function() {  getConfig();	});
			}
		});
		setInterval(function() { 
			s._ajax('GET','apps/moves/api/is_running').then(function(r) { 
				sa(function() { 
					var newrunstate = r.running ? 'Running' : 'Stopped';
					if (newrunstate !== $scope.runstate) {
						status(r.running ? 'moves started!' : 'moves terminated');
					}
					$scope.runstate = newrunstate;
				});
			}).fail(function(r) { sa(function() { $scope.runstate = 'Unknown'; }); });
			s._ajax('GET', 'apps/moves/api/get_stderr').then(function(data) {
				var messages = data && data.messages && data.messages.join('<br>').replace(/\n/g,' ');
				sa(function() { 
					console.log('got stdout ', data && data.messages.length); 
					$scope.stderr = messages || ''; 
				});
			}).fail(function(err) {	console.error('error getitng stderr ', err); });
			s._ajax('GET', 'apps/moves/api/get_stdout').then(function(data) {
				var messages = data && data.messages && data.messages.join('<br>').replace(/\n/g,' ');
				sa(function() { 
					console.log('got stdout ', data && data.messages.length); 
					$scope.stdout = messages || ''; 
				});
			}).fail(function(err) {	console.error('error w/ stdout ', err); });
		}, 6000);
	});
