/* global angular, console, _, Backbone, $ */
angular
	.module('boxie', ['ui', 'indx', 'infinite-scroll'])
	.factory('ObjsFactory', function () {
		var Objs = Backbone.Collection.extend({
			initialize: function (attributes, options) {
				if (options && options.box) { this.setBox(options.box); }
			},
			fetch: function () {
				var that = this,
					promise = $.Deferred(),
					ids = this.box.getObjIDs();
				that.box.getObj(ids).then(function (objs) {
					that.reset(objs);
					promise.resolve();
				});
				return promise;
			},
			setBox: function (box) {
				var that = this;
				this.box = box;
				that.box.on('all', function (e) {
					console.log(e, arguments)
				});
				this.box.on('obj-add', function (id) {
					that.box.getObj(id).then(function (obj) {
						that.add(obj);
					});
				});
				this.box.on('obj-remove', function (id) {
					that.box.getObj(id).then(function (obj) {
						that.remove(obj);
					});
				});
				return this;
			}
		});

		return Objs;
	})
	.factory('FilterObjsFactory', function (ObjsFactory) {
		var FilterObjs = Backbone.Collection.extend({
			initialize: function (attributes, options) {
				this.objs = new ObjsFactory(attributes, options);
				this.objs.on('add', this.add, this);
				this.objs.on('remove', this.remove, this);
				this.objs.on('reset', function (objs) {
					//this.reset(objs.models);
					//this.filtered = [];
					this.reload();
				}, this);
				this._textFilter = '';
				this.filtered = [];
			},
			fetch: function () {
				return this.objs.fetch();
			},
			setBox: function (box) {
				this.objs.setBox(box);
				return this;
			},
			textFilter: function (str) {
				this._textFilter = str.toLocaleLowerCase();
				this.reload()
			},
			reload: function () {
				this.reset(this.objs.select(this.objPassFilter, this));
				this.filtered = [];
				this.more(50);
			},
			add: function (obj) {
				if (_.isArray(obj)) {
					_.each(obj, this.add, this);
				} else {
					if (this.objPassFilter(obj)) {
						Backbone.Collection.prototype.add.apply(this, arguments);
					}
				}
				return this;
			},
			objPassFilter: function (obj) {
				if (!obj) { return false; }
				return obj.id.toLocaleLowerCase().indexOf(this._textFilter) > -1;
			},
			order: function (order) {
				this.orderField = order.field;
				this.orderAscending = order.ascending;
				this.reload();
			},
			comparator: function (model1, model2) {
				var a = model1.get(this.orderField),
					b = model2.get(this.orderField),
					sorted = [a, b].sort();
				if (this.orderAscending) { sorted.reverse(); }
				return (sorted.indexOf(a) === 0) ? -1 : 1;
			},
			more: function (count) {
				if (this.filtered.length < this.models.length) {
					console.log('more')
					var l = this.filtered.length;
					this.filtered = this.filtered.concat(this.models.slice(l, l + (count || 10))); 
				}
			}
		});

		return FilterObjs;
	})
	.controller('root', function ($scope, $location, client, utils, FilterObjsFactory) {
		'use strict';

		$scope.$watch(function() {
			return $location.path();
		}, function (path) {
			$scope.selectedBox = path.split('/')[1];
		});

		var box,
			u = utils,
			objs = new FilterObjsFactory();

		$scope.objs = objs;

		objs.on('add remove reset', function () {
			$update();
		});

		$scope.$watch('s.textFilter', function () {
			objs.textFilter($scope.s.textFilter);
		});

		$scope.$watch('s.order', function () {
			objs.order($scope.s.order)
		});

		$scope.$watch('selectedBox + selectedUser', function () {
			delete $scope.msg;
			if (!$scope.selectedUser) {
				$scope.msg = 'Please log in.';
			} else if (!$scope.selectedBox) {
				$scope.msg = 'Please select a box.';
			} else {
				$location.path($scope.selectedBox);
				client.store.getBox($scope.selectedBox)
					.then(function (box) { init(box); })
					.fail(function (e) { u.error('error ', e); $scope.msg = 'An error occured.'; });
			}
		});

		$scope.loadMore = function () {

		};

		var init = function (box) {
			window.box = box;
			window.objs = objs;
			objs.setBox(box).fetch();
		};
		var $update = function () {
			u.safeApply($scope);
		};
		$scope.s = {
			page: 0,
			order: { field: 'id', ascending: true },
			perPage: 15,
			textFilter: ''
		}; // state
		$scope.Math = window.Math;

	});
