/* global angular, console, _, Backbone, $ */
angular
	.module('boxie', ['ui','indx'])
	.controller('boxie', function($scope, client, utils, collection) {
		'use strict';

		var box,
			u = utils;

		var Box = collection.Model.extend({
				defaults: { title: 'Todo list' },
				initialize: function () {
					var that = this;

					that.update();

					this.on('update change', function () {
						that.update();
					});
				},
				update: function () {
					this.set('val', this.toJSON());
					this.set('val-string', JSON.stringify(this.toJSON(), null, ' '));
				}
			}),

			Boxes = collection.Collection.extend({
				model: Box,
				fetch: function () {
					var that = this,
						promise = $.Deferred(),
						ids = this.box.get_obj_ids(),
						objs = [],
						promises = _.map(ids, function (id) {
							var promise = $.Deferred();
							that.box.get_obj(id).then(function (obj) {
								objs.push(obj);
								promise.resolve();
							});
							return promise;
						});
					$.when.apply($, promises).then(function () {
						that.reset(objs);
						promise.resolve();
					});
					return promise;
				}
			});


		var initialize = function () {
			console.log('init');
			$scope.objs = new Boxes(undefined, { box: box });
			$scope.objs.fetch();
			$scope.objs.on('update change', function () {
				console.log('fetched');
				u.safe_apply($scope);
			});
		};

		var pop = function (arr) {
			if (!_.isArray(arr)) { return arr; }
			return _.first(arr);
		};

		$scope.pop = pop;

		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
					initialize();
				}).fail(function(e) { u.error('error ', e); });
			}
		});


	});
