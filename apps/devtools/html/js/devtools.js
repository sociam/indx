/* global $, console, angular, Backbone, _ */
angular
	.module('devtools', ['ui','indx'])
	.config(['$routeProvider', function ($routeProvider) {
		'use strict';

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
			initialize: function (attributes, options) {
				var that = this;
				this.manifest = options.manifest;
				this.on('change', function () {
					that.haveBeenRun = that.get('have_been_run');
					that.getResults();
				});
				var raw = this.manifest.get('tests');
				this.set(raw);
				this.params = this.get('params');
				_.each(this.params, function (param) {
					param.value = param['default'];
				});
				this.isAvailable = !!raw;
				this.getResults();
			},
			run: function () {
				var that = this;
				this.results = null;
				this.isRunning = true;
				var params = '';
				if (this.params) {
					var paramsObj = {};
					_.each(this.params, function (param) {
						paramsObj[param.name] = param.value;
					});
					params = '&params=' + JSON.stringify(paramsObj);
				}
				$.post('api/run_tests?id=' + this.manifest.id + params)
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
				var that = this,
					promise = $.Deferred();
				this.isLoading = true;
				$.get(this.get('url'), function (data) {
					var $tests = $(data).find('testsuite');

					that.results = $tests.map(function () {
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
					}).get()[0];

					promise.resolve();
				}).always(function () {
					that.isLoading = false;
				});
				return promise;
			},
			refresh: function () {
				this.results = null;
				this.getResults().then(function () {
					u.safeApply($rootScope);
				});
			}
		});

		var DocumentationModel = Backbone.Model.extend({
			initialize: function (attrs, options) {
				var that = this;
				this.manifest = options.manifest;
				this.on('change', function () {
					that.isBuilt = that.get('built');
				});
				var raw = this.manifest.get('documentation');
				this.set(raw);
				this.isAvailable = !!raw;
				this.docUrl = this.get('url');
			},
			build: function () {
				var that = this;
				this.isBuilding = true;
				$.post('api/build_doc?id=' + this.manifest.id)
					.then(function (r) {
						that.set(r.response);
						that.refresh();
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
			},
			refresh: function () {
				this.set('url', this.docUrl + '?_r' + Math.round(Math.random() * 1e6));
			}
		});

		var Manifest = Backbone.Model.extend({
			defaults: {
				icons: {
					'128': '/apps/devtools/icons/default.png',
					'font-awesome': { 'class': 'fa fa-cog', 'background': '#aaa', 'color': '#eee' }
				}
			},
			initialize: function () {
				this.documentation = new DocumentationModel(undefined, { manifest: this });
				this.tests = new TestsModel(undefined, { manifest: this });
				this.icon = '';
				if (this.get('icons')) {
					if (this.get('icons')['font-awesome']) {
						var fa = this.get('icons')['font-awesome'];
						this.icon = $('<i class="app-icon"></i>')
							.addClass(fa['class'])
							.css(fa)
							.wrap('<p>').parent().html();
					} else if (this.get('icons')['128']) {
						var src = this.get('icons')['128'];
						this.icon = '<img src="' + src + '" class="icon">';
					}
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
			manifests.fetched = true;
			u.safeApply($rootScope);
		});

		window.$scope = $rootScope;

		window.resizeIFrame = function (iframe, noEvents) {
			var top = $('.tab-pane nav').offset().top + $('.tab-pane nav').height(),
				wHeight = $(window).innerHeight();
			console.log('t', iframe, top, wHeight)
			$(iframe).css({ 'height': wHeight - top - 6 });
			if (!noEvents) {
				$(window).resize(function () {
					window.resizeIFrame(iframe, true);
				});
			}
		};

		return {
			manifests: manifests
		};
	})
	.controller('RootCtrl', function ($scope, manifestsService) {
		'use strict';

		_.extend($scope, {
			manifests: manifestsService.manifests
		});
		/*

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
			manifestsService.manifests.once('sync', function () {
				ready.resolve();
			});
		}

		ready.then(function () {
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
