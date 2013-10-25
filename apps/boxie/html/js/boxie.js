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
	.controller('RootCtrl', function ($scope, client, utils, collection) {
		'use strict';

		var box,
			u = utils;

		var TreeObj = collection.Model.extend({
				initialize: function () {
					collection.Model.prototype.initialize.apply(this, arguments);
					var that = this;

					that.update();

					this.on('update change', function () {
						that.update();
					});
					this.flatCollection = this.collection;
				},
				// identify and dereference links to objs within the attributes
				links_to: function (obj, links_to) {
					console.log('links to')
					var that = this,
						cache = false;
					links_to = links_to || [];
					if (typeof obj === "undefined") {
						obj = this.attributes;
						cache = true;
					}
					_(obj).each(function (v, k) {
						if (typeof v === "object") {
							if (v instanceof client.Obj) {
								obj[k] = that.flatCollection.get(v.id);
								links_to.push(v);
							} else {
								that.links_to(v, links_to);
							}
						}
					});
					if (cache) {
						this._links_to = links_to;
					}
					return links_to;
				},
				links_from: function () {
					var that = this;
					return this.flatCollection.filter(function (obj) {
						return obj.links_to().indexOf(that) > -1;
					});
				},
				is_root: function () {
					return this.links_from().length === 0;
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
				model: TreeObj,
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
						console.log('objs', objs);
						that.reset(objs);
						promise.resolve();
					});
					return promise;
				}
			}),

			ObjsTree = collection.Collection.extend({
				initialize: function (models, options) {
					this.flatCollection = new Objs(undefined, options);
					collection.Collection.prototype.initialize.apply(this, arguments);
				},
				fetch: function () {
					var that = this;
					return this.flatCollection.fetch().then(function () {
						that.buildTree();
					});
				},
				buildTree: function () {
					this.reset(this.flatCollection.select(function (obj) {
						return obj.is_root();
					}));
				}
			});


		var initialize = function () {
			console.log('init');
			$scope.objs = new ObjsTree(undefined, { box: box });
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
