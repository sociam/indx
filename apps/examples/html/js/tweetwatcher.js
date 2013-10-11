/*global $,_,document,window,console,escape,Backbone,exports,WebSocket */
/*jslint vars:true, todo:true, sloppy:true */
angular
	.module('TwitterDemoApp', ['ui', 'indx'])
	.controller('TweetWatcher', function($scope, client, utils) {
		console.log('>>>>>>>>>>>>>>>>>>>>>>> ');
		var u = utils, old_box;
		$scope.toolbar = {};
		// TODO do soemthing more dramatic
		var error = function(err) {	console.error(err); };
		var token_filter = function(x) {
			if (x.length === 0) return false;
			if (x.indexOf('http') === 0) return false;
			if (x.indexOf('#') === 0) return false;	// ignore hashtags
			if (x.indexOf('@') === 0) return false;	// ignore @ replies
			return true;
		};
		var parse_and_count = function(text) {
			var c = new Backbone.Model();
			text.split(' ').map(function(x) {
				var word = x.trim().toLowerCase();
				if (token_filter(word)) {
					c.attributes[word] = [(c.attributes[word] ? c.attributes[word][0] : 0) + 1];
				}
			});
			return c;
		};
		var sum_in = function(counts,new_counts) {
			new_counts.keys().map(function(k) {
				counts.set(k, (counts.get(k) ? counts.get(k)[0] : 0) + new_counts.get(k)[0]);
			});
		};

		var loadtweets = function(box) {
			// recount everything!
			// if ($scope.counts) {
			// 	counts.attributes = { '@id' : counts.id };
			// counts.keys().map(function(k) { if (k !== '@id') { counts.unset(k); } });
			// }
			box.get_obj(box.get_obj_ids()).then(function(objs) {
				var tings = objs.filter(function(x) { return x.get("text") !== undefined; });
				window.things = tings;
				tings.map(function(obj) {
					sum_in($scope.counts,parse_and_count(obj.get('text')[0]));
				});
				u.safe_apply($scope, function() { $scope._updated = new Date().valueOf(); });
				// counts.save();
				u.safe_apply($scope, function() { 
					$scope.counts = $scope.counts;
					$scope.counts.trigger('update-counts');
				});
			}).fail(error);
		};

		var set_counts = function(obj) {
			$scope.counts = obj;
			u.safe_apply($scope, function() { $scope.counts = obj; });
			window.counts = $scope.counts;
		};
		
		var proceed = function(box) {
			box.get_obj('word_counts').then(function(obj) {
				console.log('got obj word_counts >> ', obj);
				set_counts(obj);
				loadtweets(box);
				if (old_box !== undefined) {
					console.log("unsubscribing to old obox ****************************************************************** ");
					old_box.off('obj-add',undefined,$scope);
					old_box = box;
				}
				box.on('obj-add', function(oid) {
					box.get_obj(oid).then(function(object) {
						if (object.get("text")) {
							var newct = parse_and_count(object.get("text")[0]);
							sum_in($scope.counts, newct);
							// $scope.counts.save();
							$scope.counts.trigger('update-counts');
						} else {
							// debug 
							console.warn('new object not a tweet, skipping ', object.id);
						}
					}, $scope);
				});
			}).fail(error);
		};
		var init = function() {
			client.store.get_box($scope.toolbar.selected_box).then(function(box) { 
				window.box = box;
				proceed(box); 
			});
		};
		$scope.$watch('toolbar.selected_box', init);
		if ($scope.toolbar.selected_box) { init(); }
	});


