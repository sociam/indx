/* global angular, console, _, Backbone, $ */
angular
	.module('boxie', ['ui', 'indx'])
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
					console.log(_.map(objs, function (obj) { return obj.toJSON(); }))
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
	.controller('root', function ($scope, client, utils, ObjsFactory) {
		'use strict';

		var box,
			u = utils,
			objs = new ObjsFactory();

		$scope.objs = objs;

		objs.on('add remove reset', function () {
			$update();
		});

		$scope.$watch('selectedBox + selectedUser', function () {
			delete $scope.msg;
			if (!$scope.selectedUser) {
				$scope.msg = 'Please log in.';
			} else if (!$scope.selectedBox) {
				$scope.msg = 'Please select a box.';
			} else {
				client.store.getBox($scope.selectedBox)
					.then(function (box) { init(box); })
					.fail(function (e) { u.error('error ', e); $scope.msg = 'An error occured.'; });
			}
			
		});

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
			orderBy: 'id',
			orderReverse: false,
			perPage: 15
		}; // state
		$scope.Math = window.Math;

	}).filter('startFrom', function() {
		return function (input, start) {
			start = +start; //parse to int
			return input.slice(start);
		}
	});
