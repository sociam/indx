/* global $, console, angular, Backbone, _ */
angular
	.module('devtools', ['ui','indx'])
	.config(['$routeProvider', function ($routeProvider) {
		$routeProvider
			.when('/', { templateUrl: 'partials/root.html', controller: 'RootCtrl' })
			.when('/manifest/:id', { templateUrl: 'partials/manifest.html', controller: 'ManifestCtrl' })
			.when('/manifest/:id/:section', { templateUrl: 'partials/manifest.html', controller: 'ManifestCtrl' })
			.otherwise({ redirectTo: '/' });
	}])
	.service('manifestsService', function ($rootScope, utils) {
		'use strict';

		var u = utils;


		var TestsModel = Backbone.Model.extend({
			initialize: function () {
				Backbone.Model.prototype.initialize.apply(this, arguments);
				this.getResults();
			},
			run: function () {
				var that = this;
				this.isRunning = true;
				$.post('api/manifests/' + this.manifest.id + '/run_tests')
					.always(function () {
						that.isRunning = false;
						u.safeApply($rootScope);
					}).then(function (r) {
						that.set(r.response);
						that.err = false;
						that.getResults().then(function () {
							u.safeApply($rootScope);
						});
					}).fail(function () {
						that.err = true;
						u.safeApply($rootScope);
					});
			},
			getResults: function () {
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

					u.safeApply($rootScope);

					promise.resolve();
				});
				return promise;
			}
		});

		var DocumentationModel = Backbone.Model.extend({
			initialize: function (attrs, options) {
				this.manifest = options.manifest;
			},
			build: function () {
				console.log('blah')
				var that = this;
				this.isBuilding = true;
				$.post('api/manifests/' + this.manifest.id + '/build_doc')
					.then(function (r) {
						that.set(r.response);
						that.err = false;
						u.safeApply($rootScope);
					})
					.fail(function (r, s, err) {
						that.err = r.status + ' - ' + err;
						u.safeApply($rootScope);
					})
					.always(function () {
						that.isBuilding = false;
						u.safeApply($rootScope);
					});
			}
		});

		var Manifest = Backbone.Model.extend({
			defaults: {
				icons: {
					128: '/apps/devtools/icons/default.png'
				}
			},
			initialize: function () {
				if (this.get('documentation')) {
					this.documentation = new DocumentationModel(undefined, { manifest: this });
				}
				if (this.get('tests')) {
					this.tests = new TestsModel(undefined, { manifest: this });
				}
			}
		});

		var Manifests = Backbone.Collection.extend({
			model: Manifest,
			url: 'api/manifests',
			initialize: function () {
				var that = this;
				this.on('add remove reset', function () {
					that.apps = that.where({ type: 'app' });
					that.core = that.where({ type: 'core' });
				});
			},
			parse: function (r) {
				return r.response;
			}
		});


		var manifests = new Manifests();
		manifests.fetch().then(function () {
			u.safeApply($rootScope);
		});

		window.$scope = $rootScope;

		return {
			manifests: manifests
		};
	})
	.controller('RootCtrl', function ($scope, manifestsService) {
		'use strict';

		_.extend($scope, {
			manifests: manifestsService.manifests
		});
		/*var u = utils;

		var Test = Backbone.Model.extend({
			idAttribute: 'name',
			initialize: function () {
				Backbone.Model.prototype.initialize.apply(this, arguments);
				this.getResults();
			},
			run: function () {
				var that = this;
				this.isRunning = true;
				$.post('api/tests/run_test?name=' + this.get('name')).always(function () {
					that.isRunning = false;
					u.safeApply($scope);
				}).then(function (r) {
					that.set(r.response);
					that.err = false;
					that.getResults().then(function () {
						u.safeApply($scope);
					});
				}).fail(function () {
					that.err = true;
					u.safeApply($scope);
				});
			},
			getResults: function () {
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

					u.safeApply($scope);

					promise.resolve();
				});
				return promise;
			}
		});

		var Doc = Backbone.Model.extend({
			idAttribute: 'name',
			build: function () {
				var that = this;
				this.isBuilding = true;
				$.post('api/docs/generate_doc?name=' + this.get('name'))
					.then(function (r) {
						that.set(r.response);
						that.err = false;
						u.safeApply($scope);
					})
					.fail(function (r, s, err) {
						that.err = r.status + ' - ' + err;
						u.safeApply($scope);
					})
					.always(function () {
						that.isBuilding = false;
						u.safeApply($scope);
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
			manifests: manifests,
			activeTest: {}
		});

		// this pollution created by emax for supprting debugging
		// declares box in devtools
		var loadBox = function(bid) {
			client.store.getBox(bid).then(function(box) { 
				console.log('got box >> ', box.id);
				window.box = box; 
			});
		};		
		var init = function() {
			console.log('change on box and user --- init >> ', $scope.selectedBox, $scope.selectedUser);
			if ($scope.selectedUser && $scope.selectedBox) { 
				loadBox($scope.selectedBox); 
			}
		};
		$scope.$watch('selectedBox + selectedUser', init);
		init();
		window.store = client.store;*/
	}).controller('ManifestCtrl', function ($scope, $location, manifestsService, $routeParams) {
		'use strict';

		var ready = $.Deferred();

		if (manifestsService.manifests.fetched) {
			ready.resolve();
		} else {
			console.log('Q?')
			manifestsService.manifests.on('all', function (a) {
				console.log('b', a)
			})
			manifestsService.manifests.once('sync', function () {
				ready.resolve();
			});
		}

		ready.then(function () {
			console.log('READY')
			var manifest = manifestsService.manifests.get($routeParams.id);
			if (!manifest) {
				$location.path('/');
			}
			var panes = ['overview', 'documentation', 'tests'],
				pane = 'overview';
			if (panes.indexOf($routeParams.section) > -1) {
				pane = $routeParams.section;
			}
			
			$scope.manifest = manifest;
			$scope.pane = pane;
		});
	});
