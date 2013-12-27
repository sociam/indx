

controller = ($scope, client, utils) ->
	// populate list of users
	store = client.store
	u = utils
	sa = (fn) -> utils.safeApply($scope, fn);
	store.getUserList().then(function(users) {
		window.users = users;
		sa(function() {	$scope.users = users.concat(); });
	}).fail(function(err) { u.error(err); });
	store.getBoxList().then(function(boxes) { 
		
	});

angular.module('indx-profiles',['indx']).controller('main', controller);
