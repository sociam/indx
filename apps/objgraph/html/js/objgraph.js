/* global angular, console, _, Backbone, $ */
angular
	.module('objgraph', ['ui', 'indx'])
	.controller('root', function ($scope, client, utils) {
		'use strict';

		var box,
			u = utils;

		var /*TreeObj = collection.Model.extend({
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
							//value = _.map(value, function (value, i) {
							//	var type = typeof value;
							//	return { index: i, value: value, type: type };
							//});
						}
						return { type: type, key: key, value: value, isArray: isArray };
					});
				}
			}),*/

			Objs = Backbone.Collection.extend({
				//model: TreeObj,
				initialize: function (attributes, options) {
					this.box = options.box
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
				getGraph: function () { // returns nodes and links (edges)
					var nodes = this.map(function (obj) {
							return {
								id: obj.id,
								data: obj.attributes,
								group: getGroupFromStructure(obj)
							};
						}),
						objIds = _.pluck(nodes, 'id'),
						links = this.reduce(function (links, obj) {
							var nodeA = objIds.indexOf(obj.id),
								linkedObjs = getLinkedObjs(obj.attributes);
							return links.concat(_.map(linkedObjs, function (obj) {
								var nodeB = objIds.indexOf(obj.id);
								return { source: nodeA, target: nodeB, value: 1 };
							}));
						}, []);

					// group similar looking objs
					var groups = _.uniq(_.pluck(nodes, 'group'));
					_.each(groups, function (group) {
						var groupNodes = _.where(nodes, { group: group });
						if (groupNodes.length <= 1) { return; }

						var groupNode = { id: 'group-' + group, group: -1 },
							nodeA = nodes.length;

						nodes.push(groupNode);

						_.each(groupNodes, function (node) {
							var nodeB = nodes.indexOf(node);
							console.log({ source: nodeA, target: nodeB, value: 0 })
							links.push({ source: nodeA, target: nodeB, value: 0 });
						});
					});

					return {
						nodes: nodes,
						links: links
					};
				}
			})/*,

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
			})*/;


		var initialize = function (box) {
			console.log('init');
			/*$scope.objs = new ObjsTree(undefined, { box: box });
			$scope.objs.fetch();
			$scope.objs.on('update change', function () {
				console.log('fetched');
				u.safeApply($scope);
			});*/
			var objs = new Objs([], { box: box });
			objs.fetch().then(function () {
				var graph = objs.getGraph();
				renderGraph(graph);
			});

		};

		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				console.log('selected ', $scope.selectedUser, $scope.selectedBox);
				client.store.getBox($scope.selectedBox).then(function(box) {
					initialize(box);
				}).fail(function(e) { u.error('error ', e); });
			}
		});

		var groups = [];
		var getGroupFromStructure = function (obj) {
			var keys = _.keys(obj.attributes);
			var group = keys.sort().join('');
			var groupNumber = groups.indexOf(group);
			if (groupNumber < 0) {
				groupNumber = groups.length;
				groups.push(group);
			}
			console.log(group, groupNumber)
			return groupNumber;
		};

		var getLinkedObjs = function (obj) {
			var links = [];
			_.each(obj, function (v) {
				if (typeof v === "object") {
					if (v instanceof client.Obj) {
						links.push(v);
					} else {
						links = links.concat(getLinkedObjs(v));
					}
				}
			});
			return links;
		};


		var renderGraph = function (graph) {

			var width = 960,
				height = 500;

			var color = d3.scale.category20();

			var force = d3.layout.force()
				.charge(-40)
				.linkDistance(20)
				.size([width, height]);

			var svg = d3.select("body").append("svg")
				.attr("width", width)
				.attr("height", height);

			force
				.nodes(graph.nodes)
				.links(graph.links)
				.start();

			var tip = d3.tip()
				.attr('class', 'd3-tip')
				.offset([-10, 0])
				.html(function (d) {
					return _.map(d.data, function (v, k) {
						return "<strong>" + k + ":</strong> " + v + "";
					}).join('<br>');
				});

			svg.call(tip);

			var link = svg.selectAll(".link")
				.data(graph.links)
				.enter().append("line")
				.attr("class", "link")
				.style("stroke-width", function (d) { return Math.sqrt(d.value * 2); });

			var node = svg.selectAll(".node")
				.data(graph.nodes)
				.enter().append("circle")
				.attr("class", "node")
				.attr("r", 7)
				.style("fill", function (d) { return d.group < 0 ? 'transparent' : color(d.group); })
				.call(force.drag)
				.on('mouseover', tip.show)
				.on('mouseout', tip.hide);

			node.append("title")
				.text(function (d) { return d.id; });

			force.on("tick", function() {
				link.attr("x1", function (d) { return d.source.x; })
					.attr("y1", function (d) { return d.source.y; })
					.attr("x2", function (d) { return d.target.x; })
					.attr("y2", function (d) { return d.target.y; });

				node.attr("cx", function (d) { return d.x; })
					.attr("cy", function (d) { return d.y; });
			});
		};



	});
