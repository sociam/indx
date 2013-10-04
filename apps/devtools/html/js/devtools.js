/* global $, console, angular */
angular
	.module('devtools', ['ui','indx'])
	.controller('main', function($scope, client, utils) {
		var u = utils;
		$scope.$watch('selected_box + selected_user', function() {
			if ($scope.selected_user && $scope.selected_box) {
				console.log('getting box', $scope.selected_box);
				client.store.get_box($scope.selected_box).then(function(b) {
					box = b;
				}).fail(function(e) { u.error('error ', e); });
			}
		});
		window.s = client.store;
		window.create_random_objs = function(n, fn) {
			var ids = u.range(n || 100).map(function() {
				return 'random-generated-'+u.guid();
			});
			window.box.get_obj(ids).then(function(models) {
				console.log('models >> ', models);
				models.map(function(m) {
					if (fn) { m.set(fn()); }
					else {
						m.set({i:Math.random(), name:u.guid()});
					}
					m.save();
				});
			}).fail(function(x) { console.log(x); });
		};

		var Test = Backbone.Model.extend({
			idAttribute: 'name',
			initialize: function () {
				Backbone.Model.prototype.initialize.apply(this, arguments);
				var that = this;
				that.get_results();
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
									passed: !!$failure.length,
									failure: $failure.text()
								};
							}).get()
						};
					}).get());

					console.log(that.get('results'))
					u.safe_apply($scope);

					promise.resolve();
				});
				return promise;
			}
		});

		var Tests = Backbone.Collection.extend({
			model: Test
		});

		var tests = new Tests();

		$.get('api/tests/list_tests', function (r) {
			tests.reset(r.response);
		});

		$.get('api/docs/list_docs', function (r) {
			$scope.docs = r.response;
		});

		$scope.building_docs = {};
		$scope.build_doc = function (doc) {
			$scope.building_docs[doc.name] = true;
			$.post('api/docs/generate_doc?name=' + doc.name, function (r) {
				$scope.building_docs[doc.name] = false;
				Object.keys(r.response).forEach(function (k) {
					doc[k] = r.response[k];
				});
				u.safe_apply($scope);
			});
		};

		_.extend($scope, {
			tests: tests,
			activeTest: {}
		});

		window.$scope = $scope;
	});
