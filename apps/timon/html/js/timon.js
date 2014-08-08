/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine, angular, _, $ */
angular.module('timon',['indx', 'ngAnimate'])
	.controller('main', function($scope, client, utils, transformers) { 
		var store = client.store, 
			u = utils, box, diffQs = [],
			sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid(),
			get_user = function(store) { 
				var d = u.deferred();
				store.checkLogin().then(function(l) { 
					if (l && l.user_metadata) { 
						var um = JSON.parse(l.user_metadata);
						if (um && um.name) { return d.resolve(l, um.name); }
					}
					d.resolve(l, l.username);
				}).fail(function(err) { console.error(err); d.reject(); });
				return d.promise();
			};

		$scope._ = _;
		$scope.input = {};


		var initialise = function(boxid) { 
			// kill previous queries
			if (!(boxid && boxid.length > 0)) { return ; }

			$scope.followers = []; 
			$scope.following = {};
			$scope.channels = {};
			$scope.timeline = {};
			$scope.people = [];
			$scope.test = {};

			diffQs.map(function(q) { q.stop(); });
			diffQs = [];			

			store.getBox(boxid).then(function(b) { 
				window.b = b;
				box = b;
				b.standingQuery({ type:'post' }, function(message) { 
					sa(function() { $scope.timeline[message.id] = message; });
				}).then(function(diffid) { diffQs.push(diffid); }).fail(function(err) { 
					console.error('error setting up standing query for following ', err); 
				});
				b.standingQuery({ type:'follow' }, function(following) {
					sa(function() { $scope.following[following.peek('url')] = following; });
				}).then(function(diffid) { diffQs.push(diffid); }).fail(function(err) { 
					console.error('error setting up standing query for following ', err); 
				});
				b.standingQuery({ type:'channel' }, function(cobj) {
					sa(function() { $scope.channels[cobj.id] = cobj; });
				}).then(function(diffid) { diffQs.push(diffid); }).fail(function(err) { 
					console.error('error setting up standing query for following ', err); 
				});
				get_user(store).then(function(login, name) { 
					createChannel(b,login,name);
					$scope.login = login; 
					$scope.name = name; 
				});
			}).fail(function(err) {  console.error('error getting box ', err); });

		};
		var getChannelURL = function(store,box,id) {
			var url = [store._getBaseURL(), box.id, id].join('/');
			console.info('channel url ', url);
			return url;
		};
		var createChannel = function(box, ownerlogin, ownername) {
			var d = u.deferred();
			box.query({type:'channel'}).then(function(x) { 
				if (x.length == 0) { 
					var id = 'channel-main';
					// console.log(' no channels ');
					box.obj([id, ownerlogin.username]).then(function(objs) { 
						var ch = objs[0], user = objs[1];
						ch.set({type:'channel', owner:user, ownername:ownername, created: new Date(), url:getChannelURL(store,box,id)});
						ch.save().then(function(c) { d.resolve([c]); }).fail(d.reject);
					}).fail(d.reject);
				} else {
					d.resolve(x);
				}
			});
			return d.promise();
		};
		$scope.addFollowing = function(url) { 
			var id = 'following-'+url;
			box.obj(id).set({url:url, followed:new Date(), type:'follow'}).save();
			return true;
		};
		$scope.addPost = function(body, channel) { 
			var id = 'timon-post-'+u.guid(), 
				username = $scope.login.username, 
				name=  $scope.name, 
				d = u.deferred();
			channel = channel ? channel : $scope.channels['channel-main'];
			box.obj($scope.login.username).then(function(author) { 
				if (!author.peek('name')) { 
					author.set({name:name});
					author.save();
				}
				box.obj(id).set({body:body, author:author, created: new Date(), type:'post', channel:channel})
					.save()
					.then(d.resolve)
					.fail(function(err) { console.error('error posting tweet', err); d.reject(); });
			}).fail(function(err) { console.error('error getting author ', err); d.reject(); });

			// return d.promise();
			return true;
		};
		$scope.deletePost = function(m) { 
			delete $scope.timeline[m.id];
			m.destroy().then(function(d) { 
				console.info('deleted ', m.id);
			}).fail(function(err) { console.error('failed to delete', m.id, err); });
		};
		$scope.clearInput = function(name) { 
			$scope.input[name] = '';
			return true;
		};
		$scope.closeAddFollowing = function() { 
			$("#addFollowingModal").modal('hide');
		};
		$scope.deleteFollowing = function(m) { 
			m.destroy();
			sa(function() { delete $scope.following[m.peek('url')] });
		};

		$scope.$watch('selected_box', function(boxid) {	initialise(boxid); });

		window.$s = $scope;
		window.store = store;
		window.xfn = transformers;
	});

