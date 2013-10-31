/* global angular, console, _, Backbone, $ */
angular
	.module('boxie', ['ui','indx'])
	.config(['$routeProvider', function ($routeProvider) {

		console.log('CONFIG')
		$routeProvider
			.when('/', { templateUrl: 'partials/root.html', controller: 'RootCtrl' })
			.when('/obj/:objId', { templateUrl: 'partials/obj-detail.html', controller: 'ObjDetailCtrl' })
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
					this.icon();
					this.flatCollection = this.collection;
				},
				// identify and dereference links to objs within the attributes
				linksTo: function (obj, linksTo) {
					//console.log('links to')
					var that = this,
						cache = false;
					linksTo = linksTo || [];
					if (typeof obj === "undefined") {
						obj = this.attributes;
						cache = true;
					}
					_(obj).each(function (v, k) {
						if (typeof v === "object") {
							if (v instanceof client.Obj) {
								obj[k] = that.flatCollection.get(v.id);
								linksTo.push(v);
							} else {
								that.linksTo(v, linksTo);
							}
						}
					});
					if (cache) {
						this._linksTo = linksTo;
					}
					return linksTo;
				},
				linksFrom: function () {
					var that = this;
					return this.flatCollection.filter(function (obj) {
						return obj.linksTo().indexOf(that) > -1;
					});
				},
				isRoot: function () {
					return this.linksFrom().length === 0;
				},
				update: function () {
					this.valString = JSON.stringify(this.toJSON(), null, ' ');
					this._generateAttributeArray();
				},
				analyse: function () {
					$scope.currObj = this;
				},
				icon: function () {
					var keys = _(this.attributes).keys().sort(),
						cols = [[], [], [], [], []],
						colours = ['#F30021', '#FF8300', '#06799F', '#34D800', '#4F10AD', '#FFE500'],
						hash = function (key) {
							return {
								col: (_(key.split("")).reduce(function(memo, letter){return memo+letter.charCodeAt(0);},0))%5,
								colour: colours[-(_(key.split("").slice(1)).reduce(function(memo, letter){return memo-letter.charCodeAt(0);},0))%colours.length]
							}
						};
					_.each(keys, function (key) {
						var h = hash(key);
						console.log(key, h)
						cols[h.col].push({ key: key, colour: h.colour });
					});
					_.each(cols, function (col) {
						var k = _.reduce(col, function (i, cell) { console.log(cell); return cell.key.length; }, 0) % 2;
						if (col.length > 0 && col.length % 2 === 0) {
							if (k) {
								col.push({ colour: 'transparent' });
							} else {
								col.unshift({ colour: 'transparent' });
							}
						}
						if (col.length > 4) {
							col = col.slice(0, 4);
						}
					})
					this._icon = cols;
					return cols;
				},
				_generateAttributeArray: function () {
					this.attributeArray = _.map(this.attributes, function (value, key) {
						var type = typeof value,
							isArray = false;
						if (_.isArray(value)) {
							isArray = true;
							type = 'array';
							/*value = _.map(value, function (value, i) {
								var type = typeof value;
								return { index: i, value: value, type: type };
							});*/
						}
						return { type: type, key: key, value: value, isArray: isArray };
					});
				}
			}),

			Objs = collection.Collection.extend({
				model: TreeObj,
				fetch: function () {
					var that = this,
						promise = $.Deferred(),
						ids = this.box.getObjIds();
					that.box.getObj(ids).then(function (objs) {
						console.log(objs);
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
						return obj.isRoot();
					}));
				}
			});


		var initialize = function () {
			console.log('init');
			$scope.objs = new ObjsTree(undefined, { box: box });
			$scope.objs.fetch();
			$scope.objs.on('update change', function () {
				console.log('fetched');
				u.safeApply($scope);
			});
		};

		var pop = function (arr) {
			if (!_.isArray(arr)) { return arr; }
			return _.first(arr);
		};

		$scope.pop = pop;
		window.$scope = $scope;

		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('selected ', $scope.selectedUser, $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(b) {
					box = b;
					window.box = box;
					initialize();
				}).fail(function(e) { u.error('error ', e); });
			}
		});



	});
