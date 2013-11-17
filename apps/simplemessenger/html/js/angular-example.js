/* global window, _, console */
/* jslint vars:true, todo:true, sloppy:true */

angular
	.module('example',['ui', 'indx'])
	.controller('App', function ($scope, client, utils) {
		'use strict';

		var model,
			u = utils,
			sa = window.sa = function(fn) { u.safeApply($scope,fn); };

		_($scope).extend({
			loading: 0,
			inputmodel: {},
			toolbar: {}
		});

		// v2m
		$scope.v2m = function() {
			// view -> model
			if (!model) { console.error('model is undefined'); return; }
			console.log('saving >> ', $scope.inputmodel.value);
			model.set({value: $scope.inputmodel.value}, {silent:true});
			try { model.save();	} catch (err) { console.error(err); }
		};
		var m2vUpdate = function() {
			if (!model) { console.error(' model is undefined'); return; }
			var val = model.get('value') !== undefined ? model.get('value')[0] : '';
			console.log('update view val >> ', val);
			if (val !== $scope.inputmodel.value) {
				sa(function() {
					$scope.inputmodel.value = val;
					console.log('setting inputmodel to ', $scope.inputmodel.value);
				});
			}
		};
		var initialize = function(box) {
			console.log('hello')
			box.getObj('example1').then(function (o) {
				console.log('object example --- ', o);

				model = o;
				window.model = o;

				// model -> scope
				model.on('change:value', m2vUpdate);
				m2vUpdate();
			});
		};

		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function () {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('selected ', $scope.selectedUser, $scope.selectedBox);
				client.store.getBox($scope.selectedBox)
					.then(function (box) {
						initialize(box);
					})
					.fail(function (e) {
						u.error('error ', e);
					});
			}
		});

		// debug
		window.$scope = $scope;
	});

				
