/* global angular, console, _, Backbone, $ */
angular
	.module('objgraph', ['ui', 'indx'])
	.controller('root', function ($scope, client, utils) {
		'use strict';

		var box,
			u = utils;

		var Objs = Backbone.Collection.extend({
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
			});


		var initialize = function (box) {
			console.log('init');
			/*$scope.objs = new ObjsTree(undefined, { box: box });
			$scope.objs.fetch();
			$scope.objs.on('update change', function () {
				console.log('fetched');
				u.safeApply($scope);
			});*/
			var objs = new Objs([], { box: box });
			$scope.objs = objs;
			objs.fetch().then(function () {
				var graph = objs.getGraph();
				renderGraph(graph);
				u.safeApply($scope);
			});

		};

		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
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
				.charge(-50)
				.linkDistance(30)
				.size([width, height]);


			var zoom = d3.behavior.zoom()
				.scaleExtent([1, 10])
				.on("zoom", zoomed);

			var drag = d3.behavior.drag()
				.origin(function(d) { return d; })
				.on("dragstart", dragstarted)
				.on("drag", dragged)
				.on("dragend", dragended);

			var svg = d3.select("body").append("svg")
				.attr("width", width)
				.attr("height", height)
				.style("pointer-events", "all")
				.call(zoom);

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


			var container = svg.append("g");

			var link = container.selectAll(".link")
				.data(graph.links)
				.enter().append("line")
				.attr("class", "link")
				.style("stroke-width", function (d) { return Math.sqrt(d.value * 2); });

			var node = container.selectAll(".node")
				.data(graph.nodes)
				.enter().append("circle")
				.attr("class", "node")
				.attr("r", 5)
				.style("fill", function (d) { return d.group < 0 ? 'transparent' : color(d.group); })
				.style("stroke", function (d) { return d.group < 0 ? 'transparent' : "#fff"; })
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


function zoomed() {
  container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function dragstarted(d) {
  d3.event.sourceEvent.stopPropagation();
  d3.select(this).classed("dragging", true);
}

function dragged(d) {
  d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
}

function dragended(d) {
  d3.select(this).classed("dragging", false);
}
		};



	});
