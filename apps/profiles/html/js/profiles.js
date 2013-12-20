
angular.module('indx-profiles',['indx']).controller('main', 
	function($scope, client, utils) {
		// populate list of users
		var store = client.store, u = utils, sa = function(fn) { return utils.safeApply($scope, fn); };
		var message = function(msg) { sa(function() { $scope.message = msg; }); };

		$scope.isSelected = function(u) { return u === $scope.user; };
		$scope.defaultpic = 'img/person_icon.png';
		$scope.createUser = function(u) { 
			console.warn('create user', u);
			sa(function() { 
				delete $scope.creating;
				delete $scope._new_username;
			});
		};
		var _stage = function(u) {
			var props = _(u.keys()).difference(['@id','type']);
			var staged = utils.dict(props.map(function(p) { return [p, u.peek(p)]; }));
			console.log('staged > ', staged);
			return staged;
		};
		var initialise = function(users) { 
			sa(function() { 
				$scope.users = users;
				$scope.user = users[0];
				_stage($scope.user);
			});
		};
		$scope.selectUser = function(u)  {
			// take staged user
			if ($scope.staged) { 
				$scope.user.set($scope.staged);
				$scope.user.save();
			}
			sa(function() { 
				$scope.staged = _stage(u); 
				$scope.user = u;
			});
		};
		store.getBoxList().then(function(boxids) { 
			boxids.sort();
			store.getBox(boxids[0]).then(function(box) { 
				store.getUserList().then(function(users) {
					window.users = users;
					box.getObj(users.map(function(x) { return x["@id"]; })).then(function(boxusers) {
						boxusers.map(function(bu) { 
							var match = users.filter(function(x) { return bu.id === x["@id"]; })[0];
							bu.set(match);
							bu.save();
						});
						initialise(boxusers);
					});
					sa(function() {	$scope.users = users.concat(); });
				}).fail(function(err) { u.error(err); });			
			});
		});
		// we really need to store these in one box 
	});
