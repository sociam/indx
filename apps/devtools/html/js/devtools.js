/* global $, console, angular, Backbone, _ */
angular
	.module('devtools', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		'use strict';

		var u = utils;

		var Test = Backbone.Model.extend({
			idAttribute: 'name',
			initialize: function () {
				Backbone.Model.prototype.initialize.apply(this, arguments);
				this.get_results();
			},
			run: function () {
				var that = this;
				this.is_running = true;
				$.post('api/tests/run_test?name=' + this.get('name'), function (r) {
					that.is_running = false;
					that.set(r.response);
					that.get_results().then(function () {
						u.safe_apply($scope);
					});
				});
			},
			get_results: function () {
				console.log('GET RESULTS', this);
				var that = this,
					promise = $.Deferred();
				$.get('/' + this.get('url') + '/test-results.xml', function (data) {
					var $tests = $(data).find('testsuite');

					that.set('results', $tests.map(function () {
						var $test = $(this),
							failures = Number($test.attr('failures')),
							errors = Number($test.attr('errors'));

						return {
							name: $test.attr('name'),
							//fullname: $test.attr('name'),
							failures: failures,
							errors: errors,
							tests: Number($test.attr('tests')),
							pass: failures + errors === 0,
							timestamp: $test.attr('timestamp'),
							time: $test.attr('time'),
							testcases: $test.find('testcase').map(function () {
								var $testcase = $(this),
									$failure = $testcase.find('failure');
								return {
									name: $testcase.attr('name'),
									classname: $testcase.attr('classname'),
									time: Number($testcase.attr('time')),
									passed: !$failure.length,
									failed: !!$failure.length,
									failure: $failure.text()
								};
							}).get()
						};
					}).get());

					u.safe_apply($scope);

					promise.resolve();
				});
				return promise;
			}
		});

		var Doc = Backbone.Model.extend({
			idAttribute: 'name',
			build: function () {
				var that = this;
				this.is_building = true;
				$.post('api/docs/generate_doc?name=' + this.get('name'))
					.then(function (r) {
						that.set(r.response);
						that.err = false;
					})
					.fail(function (r, s, err) {
						that.err = r.status + ' - ' + err;
						u.safe_apply($scope);
					})
					.always(function () {
						that.is_building = false;
						u.safe_apply($scope);
					});
			}
		});

		var Tests = Backbone.Collection.extend({
			model: Test
		});

		var Docs = Backbone.Collection.extend({
			model: Doc
		});

		var tests = new Tests(),
			docs = new Docs();

		$.get('api/tests/list_tests', function (r) {
			tests.reset(r.response);
		});

		$.get('api/docs/list_docs', function (r) {
			docs.reset(r.response);
		});

		_.extend($scope, {
			tests: tests,
			docs: docs,
			activeTest: {}
		});

		// declares box in devtoosl

		var load_box = function(bid) {
			client.store.get_box(bid).then(function(box) {
				console.log('boxx > ', box);
				window.box = box;
			});
		};

		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_box) {
				load_box($scope.selected_box);
			}
		});

		window.$scope = $scope;
	});
