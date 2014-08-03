/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global require, exports, console, process, module, describe, it, expect, jasmine, angular */
angular.module('timon',['indx', 'ngAnimate'])
	.filter('orderObjectBy', function() {
		return function(items, field, reverse) {
		    var filtered = [];
		    angular.forEach(items, function(item) { filtered.push(item);  });
		    filtered.sort(function (a, b) {
		      var av = a.peek(field), bv = b.peek(field);
		      if (_.isDate(av)) { av = av.valueOf(); }
		      if (_.isDate(bv)) { bv = bv.valueOf(); }
		      return (av > bv ? 1 : -1);
		    });
		    if(reverse) filtered.reverse();
		    return filtered;
		};
	}).controller('main', function($scope, client, utils, channels) { 
		
		var store = client.store, 
			u = utils, box, diffQs = [],
			sa = function(fn) { return u.safeApply($scope, fn); },
			guid = u.guid();

		var get_user = function(store) { 
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

		var initialise = function(boxid) { 
			// kill previous queries
			if (!(boxid && boxid.length > 0)) { return ; }

			diffQs.map(function(q) { q.stop(); });

			$scope.followers = []; 
			$scope.following = {};
			$scope.timeline = {};
			$scope.people = [];
			$scope.test = {};

			store.getBox(boxid).then(function(b) { 
				box = b;
				b.standingQuery({ type:'timpost' }, function(message) { 
					console.info('new post coming in > ', message);
					sa(function() { $scope.timeline[message.id] = message; });
				}).then(function(diffid) { diffQs.push(diffid); }).fail(function(err) { 
					console.error('error setting up standing query for following ', err); 
				});
				b.standingQuery({ type:'timfollow' }, function(following) {
					console.info('new following > ', following);
					sa(function() { $scope.following[following.peek('url')] = following; });
				}).then(function(diffid) { diffQs.push(diffid); }).fail(function(err) { 
					console.error('error setting up standing query for following ', err); 
				});
			}).fail(function(err) {  console.error('error getting box ', err); });

			get_user(store).then(function(login, name) { 
				$scope.login = login; 
				$scope.name = name; 
			});
		};

		$scope.addFollowing = function(url) { 
			console.log('adding following url ... ', url);
			var id = 'following-'+url;
			return box.obj(id).set({url:url, followed:new Date(), type:'timfollow'}).save();
		};
		$scope.addPost = function(body) { 
			console.log('add post >> ', body);

			var id = 'timpost-'+u.guid(), 
				username = $scope.login.username, 
				name=  $scope.name, 
				d = u.deferred();


			box.obj($scope.login.username).then(function(author) { 
				if (!author.peek('name')) { 
					author.set({name:name});
					author.save();
				}
				box.obj(id).set({body:body, author:author, created: new Date(), type:'timpost'})
					.save()
					.then(d.resolve)
					.fail(function(err) { console.error('error posting tweet', err); d.reject(); });
			}).fail(function(err) { console.error('error getting author ', err); d.reject(); });

			return d.promise();
		};
		$scope.deletePost = function(m) { 
			delete $scope.timeline[m.id];
			m.destroy().then(function(d) { 
				console.info('deleted ', m.id);
			}).fail(function(err) { console.error('failed to delete', m.id, err); });
		};
		$scope.clearNewPostInput = function() { 
			console.log('clearnewpostinput');
			$scope.newpostinput.text = '';
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
		window.chan = channels;
	});

console.log('hello hello');