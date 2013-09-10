/* global angular, console, _, Backbone, $ */
angular
	.module('boxie', ['ui','indx'])
	.config(['$routeProvider', function ($routeProvider) {

		console.log('CONFIG')
		$routeProvider
			.when('/', { templateUrl: 'partials/root.html', controller: 'RootCtrl' })
			.when('/obj/:obj_id', { templateUrl: 'partials/obj-detail.html', controller: 'ObjDetailCtrl' })
			.otherwise({ redirectTo: '/obj/1' });
	}])
	.controller('RootCtrl', function ($scope, $routeProvider, client, utils, collection) {
		'use strict';

		console.log('PLEASE WORK')

		var box,
			u = utils;

		var Obj = collection.Model.extend({
				initialize: function () {
					var that = this;

					that.update();

					this.on('update change', function () {
						that.update();
					});
				},
				update: function () {
					this.val_string = JSON.stringify(this.toJSON(), null, ' ');
					this._generate_attribute_array();
				},
				analyse: function () {
					$scope.curr_obj = this;
				},
				_generate_attribute_array: function () {
					this.attribute_array = _.map(this.attributes, function (value, key) {
						var type = typeof value,
							is_array = false;
						if (_.isArray(value)) {
							is_array = true;
							type = 'array';
							/*value = _.map(value, function (value, i) {
								var type = typeof value;
								return { index: i, value: value, type: type };
							});*/
						}
						return { type: type, key: key, value: value, is_array: is_array };
					});
				}
			}),

			Objs = collection.Collection.extend({
				model: Obj,
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
			$scope.objs = new Objs(undefined, { box: box });
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
		window.$scope = $scope;

		// watches the login stts for changes
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('selected ', $scope.selected_user, $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
		window.box = box;
					initialize();
				}).fail(function(e) { u.error('error ', e); });
			}
		});



	});
