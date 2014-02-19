/* global angular, console, _, Backbone, $ */
angular
	.module('objeditor', ['ui', 'indx', 'infinite-scroll'])
	.controller('root', function ($scope, $location, client, utils) {
		'use strict';

		var box,
			objIDs,
			u = utils;

		$scope.$watch(function() {
			return $location.path();
		}, function (path) {
			$scope.selectedBox = path.split('/')[1];
			$scope.s.objID = path.split('/')[2];
		});

		$scope.$watch('s.objID', function () {
			if (!$scope.s.objID || !box) { return; }
			console.log('check')
			$scope.s.objExists = objIDs.indexOf($scope.s.objID) > -1;
		});

		$scope.$watch('s.selectedObj', function () {
			$location.path($scope.selectedBox + '/' + $scope.s.objID);
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

		var init = function (_box) {
			box = _box;
			objIDs = box.getObjIDs();
			$scope.loadObj();
		};
		$scope.loadObj = function () {
			if (!box || !$scope.s.objID) { return; }
			console.log('load')
			box.getObj($scope.s.objID).then(function (obj) {
				console.log('LOADED')
				$scope.s.obj = obj;
				$scope.$apply();
			});
		}
		$scope.s = {}; 

	});
