/* global angular, console, _, Backbone */
angular
	.module('boxie', ['ui','indx'])
	.controller('boxie', function($scope, client, utils) {
		'use strict';

		var box,
			u = utils;


		var update_view = function (objs) {
			u.safe_apply($scope, function () {
				$scope.objs = objs.models;
			});
		};

		var Obj = Backbone.Model.extend({
			sync: function (method) {
				var that = this;
				if (method === 'read') {
					box.get_obj(this.id).then(function (val) {
						that.set('val', val);
						that.set('val-string', JSON.stringify(val, null, ' '));
					});
				}
			}
		});

		var update_watcher = function() {
			if (!box) { u.debug('no box, skipping '); return ;}
			window.box = box;
			var obj_ids = box.get_obj_ids(),
				objs = new Backbone.Collection(_.map(obj_ids, function (id) {
					var obj = new Obj({ id: id });
					obj.on('change:val', function () {
						update_view(objs);
						console.log(arguments)
					}).fetch();
					return obj;
				}));
		};

		$scope.an_obj_to_contain_the_selected_obj = { }; // Angular scoping ftw

		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
					update_watcher();
				}).fail(function(e) { u.error('error ', e); });
			}
		});


	});
