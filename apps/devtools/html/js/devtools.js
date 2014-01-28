/* global $, console, angular, Backbone, _ */
angular
	.module('devtools', ['ngRoute', 'ui','indx'])
	.config(['$routeProvider', function ($routeProvider) {
		'use strict';

		$routeProvider
			.when('/', { templateUrl: 'partials/dashboard.html', controller: 'DashboardCtrl' })
			.when('/manifest/:id', { templateUrl: 'partials/manifest.html', controller: 'ManifestCtrl' })
			.when('/manifest/:id/:section', { templateUrl: 'partials/manifest.html', controller: 'ManifestCtrl' })
			.otherwise({ redirectTo: '/' });
	}])
	.service('manifestsService', function ($rootScope, utils, client) {
		'use strict';

		var u = utils,
			box,
			testrunner;

		var testModes = {
			failed: ['Tests failed', 'Some tests have failed'],
			passed: ['Tests passed', 'All tests passed'],
			notrun: ['Tests not run', 'Tests have not yet been run'],
			running: ['Tests running', 'Tests are currently running'],
			none: ['No tests', 'No tests have been provided']
		};

		var Test = Backbone.Model.extend({
			initialize: function (attributes, options) {
				var that = this;
				this.manifest = options.manifest;
				this.on('change', function () {
					console.log('changed', that.toJSON())
					that.haveBeenRun = that.get('have_been_run');
					that.isStarted = that.get('started');
					that.mode = 
						that.isRunning ? 'running' :
							(that.haveBeenRun ?
								(that.results.failures > 0 ? 'failed' : 'passed') :
								'notrun');
					that.modeDescription = testModes[that.mode];
					//that.getResults();
				});
				this.trigger('change');
				this.params = this.get('params');
				_.each(this.params, function (param) {
					param.value = param['default'];
				});
				/*box.getObj('test-' + this.manifest.get('name')).then(function (obj) {
					that.obj = obj;
					obj.on('change', function () {
						console.log('test obj change', obj);
					});
				});*/
				//this.getResults();
			},
			start: function (singleRun) {
				var that = this,
					promise = $.Deferred();

				box.getObj(this.obj.id + '-instance-' + u.uuid()).then(function (instance) {
					instance.save({
						'invoked': [true],
						'singleRun': [!!singleRun],
						'params': [JSON.stringify(that.params)]
					}).then(function () {
						var instances = that.obj.get('instances') || [];
						instances.push(instance);
						that.obj.save({
							instances: instances
						}).then(function () {
							promise.resolve();
							u.safeApply($rootScope);
						});
					});
				});

				return promise;


				//this.results = null;
				//this.isRunning = true;
				/*var params = this.paramsStr();
				if (singleRun) {
					params += '&singlerun=' + true;
				}
				$.post('api/start_test?' + params)
					.always(function () {
						//that.isRunning = false;
						u.safeApply($rootScope);
					}).then(function (r) {
						that.set(r.response);
						that.err = false;
						//that.getResults().then(function () {
						//	u.safeApply($rootScope);
						//});
					}).fail(function () {
						that.err = true;
						u.safeApply($rootScope);
					});*/
			},
			/*paramsStr: function () {
				var params = 'id=' + this.id;
				params += '&manifest_id=' + this.manifest.id;
				if (this.params) {
					var paramsObj = {};
					_.each(this.params, function (param) {
						paramsObj[param.name] = param.value;
					});
					params += '&params=' + JSON.stringify(paramsObj);
				}
				return params;
			},
			stop: function (singleRun) {
				var that = this;
				//this.isRunning = true;
				var params = this.paramsStr();
				$.post('api/stop_test?' + params)
					.always(function () {
						//that.isRunning = false;
						u.safeApply($rootScope);
					}).then(function (r) {
						that.set(r.response);
						that.err = false;
						//that.getResults().then(function () {
						//	u.safeApply($rootScope);
						//});
					}).fail(function () {
						that.err = true;
						u.safeApply($rootScope);
					});
			},*/
			runOnce: function () {
				this.singleRun(true);
			},
			/*getResults: function () {
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
			}*/
		});

		var Tests = Backbone.Collection.extend({
			model: Test,
			initialize: function (models, options) {
				var that = this;
				this.options = options;
				this.on('change add reset remove', function () {
					var mode = 'none',
						modes = _(that.models).pluck('mode');
					if (modes.indexOf('passed') > -1) { mode = 'passed'; }
					if (modes.indexOf('notrun') > -1) { mode = 'notrun'; }
					if (modes.indexOf('failed') > -1) { mode = 'failed'; }
					if (modes.indexOf('running') > -1) { mode = 'running'; }
					that.mode = mode;
					that.modeDescription = testModes[that.mode];
				});
				this.trigger('change');
			},
			add: function (model, options) {
				var that = this;
				console.log('adding', model)
				if (_.isArray(model)) {
					_.each(model, function (model) {
						that.add(model, options);
					});
					return this;
				}
				if (!(model instanceof Backbone.Model)) {
					console.log('we\'re adding', model)
					model.id = this.length;
					console.log(model)
					model = new this.model(model, this.options);
				}
				return Backbone.Collection.prototype.add.call(this, model, options);
			}
		});

		var documentationModes = {
			'building': ['Building docs', 'Documentation is currently being built'],
			'built': ['Docs available', 'Documentation is available'],
			'notbuilt': ['Docs not built', 'Documentation needs to be built'],
			'none': ['No docs', 'No documentation has been provided']
		};

		var DocumentationModel = Backbone.Model.extend({
			initialize: function (attrs, options) {
				var that = this;
				this.manifest = options.manifest;
				this.on('change', function () {
					that.isBuilt = that.get('built');
					that.mode = 
						that.isAvailable ? 
							(	that.isBuilding ? 'building' :
								that.isBuilt ? 'built' : 'notbuilt' ) : 'none'
					that.modeDescription = documentationModes[that.mode];
				});
				var raw = this.manifest.get('documentation');
				this.isAvailable = !!raw;
				this.docUrl = this.get('url');
				this.set(raw, { silent: true }).trigger('change');
			},
			/*build: function () {
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
			},*/
			startBuild: function () {
				var that = this;
				this.trigger('start_build');
			},
			refresh: function () {
				this.set('url', this.docUrl + '?_r' + Math.round(Math.random() * 1e6));
			}
		});

		var Manifest = Backbone.Model.extend({
			defaults: {
				icons: {
					'128': '/apps/devtools/icons/default.png',
				}
			},
			initialize: function () {
				var that = this;
				this.documentation = new DocumentationModel(undefined, { manifest: this });
				this.tests = new Tests(this.get('tests'), { manifest: this });
				this.icon = this.get('icons')['128'];
				this.documentation.on('all', function (event) {
					if (['start_build', 'end_build'].indexOf(event) === -1) { return; }
					//var args = Array.prototype.slice.call(arguments, 1);
					//Backbone.Model.prototype.trigger.apply(that, args);
					//console.log(event, args)
					that.trigger(event, that, that.documentation);
				});
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
					that.hasFetched = true;
				});
			},
			parse: function (r) {
				return r.response;
			}
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

		var manifests = new Manifests();

		var pushCommand = function (obj, command) {
			var queue = obj.get('command-queue');
			queue.push(command);
			obj.save('command-queue', queue);
		};

		var updateTest = function (obj, id, attributes) {
			var dfd = $.Deferred(),
						var testObj = _(obj.get('tests')).where(id).pop();

			if (testObj) {
				dfd.resolve();
			} else {
				box.getObj('testrunner-manifest_' + manifest.id + '-test_' + test.id, function (obj) {
					obj.set(id);
					var tests = obj.get('tests');
					tests.push(obj);
					obj.save('tests', tests).then(function () {
						testObj = obj;
						dfd = $.Deferred();
					});
				});
			}
			dfd.resolve(function () {
				testObj.set(attributes);
			})
			return dfd;
		}

		var start = function () {
			// get the root obj
			var testrunnerObj,
				docsbuilderObj,
				dfd1 = box.getObj('testrunner').then(function (obj) {
					if (!obj.has('command-queue')) { obj.set('command-queue', []); }
					if (!obj.has('tests')) { obj.set('tests', []); }
					testrunnerObj = obj;
				}),
				dfd2 = box.getObj('docsbuilder').then(function (obj) {
					if (!obj.has('command-queue')) { obj.set('command-queue', []); }
					if (!obj.has('docs')) { obj.set('docs', []); }
					docsbuilderObj = obj;
				}),
				dfd3 = manifests.fetch();

			$.when(dfd1, dfd2, dfd3).then(function () {
				manifests.fetched = true;
				u.safeApply($rootScope);

				manifests.on('start_test', function (manifest, test) {
					var id = { manifest_id: manifest.id, test_id: test.id };
					updateTest(testrunnerObj, id, { state 'started' }).then(function (test) {
						pushCommand(testrunnerObj, _.extend({ action: 'start', test: test }, id));
					});
				});
				manifests.on('run_test', function (manifest, test) {
					var id = { manifest_id: manifest.id, test_id: test.id };
					updateTest(testrunnerObj, id, { state 'running' }).then(function (test) {
						pushCommand(testrunnerObj, _.extend({ action: 'run', test: test }, id));
					});
				});
				manifests.on('stop_test', function (manifest, test) {
					var id = { manifest_id: manifest.id, test_id: test.id };
					updateTest(testrunnerObj, id, { state 'stopping' }).then(function (test) {
						pushCommand(testrunnerObj, _.extend({ action: 'stop', test: test }, id));
					});
				});
				manifests.on('start_build', function (manifest, doc) {
					var id = { manifest_id: manifest.id, doc_id: doc.id };
					updateDoc(testrunnerObj, id, { state 'stopped' }).then(function (doc) {
						pushCommand(testrunnerObj, _.extend({ action: 'start', doc: doc }, id));
					});
				});
				manifests.on('stop_build', function (manifest, doc) {
					var id = { manifest_id: manifest.id, doc_id: doc.id };
					updateDoc(testrunnerObj, id, { state '?' }).then(function (doc) {
						pushCommand(testrunnerObj, _.extend({ action: 'stop', doc: doc }, id));
					});
				});
			})


			/*.then(function () {
				var promises = [];
				// populate the testrunner object
				manifests.each(function (manifest) {
					manifest.tests.each(function (test) {
						var promise = $.Deferred(),
							obj = _(testrunner.get('tests')).find(function (obj) {
								return ((obj.get('manifest_id') || [])[0] === manifest.id) &&
									((obj.get('test_id') || [])[0] === test.id);
							});
						if (obj) {
							promise.resolve();
						} else {
							console.log('test', manifest.id, test.id, '  NOT FOUND')
							box.getObj('test-' + manifest.id + '-' + test.id).then(function (_obj) {
								obj = _obj;
								obj.save({
									manifest_id: [manifest.id],
									test_id: [test.id],
									instances: []
								}).then(function () {
									testrunner.get('tests').push(obj);
									testrunner.save().then(function () {
										promise.resolve();
									});
								});
							});
						}
						promise.then(function () {
							test.obj = obj;
						});
						promises.push(promise);
					});
				});*/
			//});
		};

		var loadBox = function(bid) {
			console.log('LOAD BOX', bid)
			client.store.getBox(bid).then(function (_box) {
				console.log('got box >> ', _box.id);
				box = _box;
				window.box = box;
				box.getObj('testrunner').then(function (_testrunner) {
					testrunner = _testrunner;
					console.log('GOT testrunner', testrunner.get('tests'))
					if (!testrunner.has('tests')) {
						testrunner.set({ tests: [] });
					}
					start();
				});
			});
		};
		var init = function() {
			console.log('change on box and user --- init >> ', $rootScope.selectedBox, $rootScope.selectedUser);
			if ($rootScope.selectedUser && $rootScope.selectedBox) {
				loadBox($rootScope.selectedBox);
			}
		};
		$rootScope.$watch('selectedBox + selectedUser', init);
		window.store = client.store;

		window.manifests = manifests;
		$rootScope.breadcrumbs = [{ name: 'Dashboard', url: '#' }]

		return {
			manifests: manifests
		};
	})
	.controller('DashboardCtrl', function ($rootScope, $scope, manifestsService) {
		'use strict';

		$scope.manifests = manifestsService.manifests
		$rootScope.breadcrumbs = [$rootScope.breadcrumbs[0]]
	}).controller('ManifestCtrl', function ($rootScope, $scope, $location, manifestsService, $routeParams) {
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
			$rootScope.breadcrumbs = [$rootScope.breadcrumbs[0], { name: manifest.get('name'), url: '#/manifest/' + $routeParams.id }]
		});
	});
