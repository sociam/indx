
angular.module('indx-profiles',['indx']).controller('main', 
	function($scope, client, utils) {
		// populate list of users
		var store = client.store, u = utils, box, sa = function(fn) { return utils.safeApply($scope, fn); };
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
			console.log("_stage >> ", u);
			var props = _(u.keys()).difference(['@id','type']);
			var staged = props.map(function(p) { 
				return {name:p, value: u.peek(p), original:u.peek(p)}; 
			});
			console.log('staged > ', staged);
			return staged;
		};
		var initusers = function() {
			store.getUserList().then(function(users) {
				box.getObj(users.map(function(x) { return x["@id"]; })).then(function(boxusers) {
					boxusers.map(function(bu) { 
						var usermatch = users.filter(function(x) { return bu.id === x["@id"]; })[0];
						var updates = _(usermatch).map(function(v,k) {
							if (!bu.peek(k)) { bu.set(k,v); return true; }
						});
						if (updates.length) { bu.save(); }
					});
					window.users = boxusers;
					sa(function() { 
						$scope.users = boxusers;
						if (!$scope.user) { $scope.selectUser(boxusers[0]); }
					});
				});				
			}).fail(function(err) { u.error(err); });			
		};
		$scope.blurFocus = function() { setTimeout(function() { $('input:focus').blur(); }, 10);		};
		$scope.changedProps = function(staged) { 
			var result = staged && staged.filter(function(x) { return x.original !== x.value || x.deleted; }).length;	
			return result;
		};
		$scope.saveChanged = function(user,staged) {
			console.log('savechanged >> ', staged);
			var changes = staged.map(function(prop) {
				if (prop.deleted) { 
					user.unset(prop.name);
					return true;	
				}
				if (prop.value !== prop.original) {
					user.set(prop.name,prop.value);
					console.log('setting ', prop.name, prop.value);
					sa(function() { prop.original = prop.value; });
					return true;
				}
			});
			if (changes.length) { user.save(); }
			$scope.staged = staged.filter(function(x) { return !x.deleted; });
		};
		$scope.openNewProp = function() { 
			console.log('focusnewporp');
			$scope.newpropkey = '';
			setTimeout(function() { $('.keyname').focus(); }, 100);
		};
		$scope.openNewUserDialog = function() {
			console.log('opennewuserdialog');
			document.dispatchEvent(new Event('open-new-user-dialog'));
		};
		$scope.createNewProp = function(propname, staged) {
			console.log('createNewProp', propname,staged);
			if (propname.trim().length && $scope.staged) {
				var matching_keys = $scope.staged.filter(function(x) { return x.name.trim() === propname.trim(); });
				sa(function() { 
					var match = {};
					if (matching_keys.length) {
						match = matching_keys[0];
					} else {
					 	$scope.staged.push(match);
					}
					_(match).extend({
						name:propname,
						value:'',
						original:'',
						deleted:false
					});
					delete $scope.newpropkey;
				});
			} else {
				console.error('property value 0 or already existent', propname)
			}
		}
		$scope.selectUser = function(u)  {
			// take staged user
			sa(function() { 
				$scope.staged = _stage(u); 
				$scope.user = u;
			});
		};

		var get_acls = function() {
			$scope.boxacls = {};
			window.boxacls = $scope.boxacls;
			store.getBoxList().then(function(boxids) {
				u.when(boxids.map(function(boxid) {	return store.getBox(boxid);	}))
					.then(function(boxes) {
						boxes.map(function(box) {
							box.getACL().then(function(acls) {
								sa(function() {	
									$scope.boxaclsloaded = true;
									$scope.boxacls[box.id] = acls;	
								});
							});
						});
					});
				});
		};

		store.getBoxList().then(function(boxids) { 
			boxids.sort();
			store.getBox(boxids[0]).then(function(box_) { 
				box = box_; // debug
				initusers();
			});
		});
		// we really need to store these in one box 
		store.on('new-user', function() { initusers(); });
		get_acls();

	}).controller('NewUserDialog', function($scope,client,utils) {
		var store = client.store, u = utils, sa = function(fn) { return utils.safeApply($scope, fn); };
		var error = function(msg) { sa(function() { $scope.error = msg; }); };
		var el = angular.element('.newuserdialog');
		var show = function() { 
			el.modal({backdrop:true,keyboard:true,show:true});
		};
		var hide = function() {	el.modal('hide');};
		document.addEventListener('open-new-user-dialog', function() { 
			console.log('got a open new user dialog');
			show(); 
		});
		$scope.newuser = function(uid,password) {
			uid = uid.trim();
			if (uid.length == 0) { return error('Please choose a user id above'); }
			if (password.length == 0) { return error('Please supply a password '); }
			sa(function() { $scope.loading = true; });
			store.getUserList().then(function(ul) { 
				var ids =  _(ul).map(function(x) { return x['@id']; });
				if (ids.indexOf(uid) >= 0) {
					sa(function() { delete $scope.loading; });
					return error('A user with id ', uid, ' already exists ');
				}
				store.createUser(uid,password).then(function() { 
					// dismiss
					sa(function() { delete $scope.loading; });
					hide();
					store.trigger('new-user',uid);
				}).fail(function(err) { 
					sa(function() { delete $scope.loading});
					error(err.toString+'');
				})
			});
		};
	});
