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
					var that = this;
					this.box = options.box
					that.box.on('all', function (e) {
						console.log(e, arguments)
					})
					this.box.on('obj-add', function (id) {
						that.box.getObj(id).then(function (obj) {
							that.add(obj);
						});
					});
					this.box.on('obj-remove', function (id) {
						that.box.getObj(id).then(function (obj) {
							that.remove(obj);
						});
					});
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
				}
			});

		// creates a graph (nodes and links) from linked objs
		var Graph = Backbone.View.extend({
			initialize: function (options) {
				this.objs = options.objs;
				this.objs.on('reset', this.reset, this);
				this.objs.on('add', this.add, this);
				this.objs.on('remove', this.remove, this);

				this.nodes = [];
				this.links = [];

				this.clustering = options.clustering;

				this.reset();
			},
			reset: function () {
				this.nodes.splice(0, this.nodes.length);
				this.links.splice(0, this.nodes.length);
				this.groups = [];
				this.linkCaches = {}; // obj_id -> [obj_id, obj_id, ...]

				this.objs.each(this.add, this);
			},
			getNode: function (id) {
				var node = _.where(this.nodes, { id: id }).pop();
				return this.nodes.indexOf(node);
			},
			add: function (obj) {
				console.log('ADD')
				var that = this,
					node = {};
				this.nodes.push(node);
				this.update(node, obj);
				obj.on('change', function () {
					that.update(node, obj);
				});
			},
			update: function (node, obj) {
				_.extend(node, {
					id: obj.id,
					data: obj.attributes,
					group: this.getObjGroup(obj)
				});
				this.updateLinks(obj);
				this.removeFromCluster(obj);
				if (this.clustering) {
					this.addToCluster(obj);
				}
				// todo: trigger update
				this.trigger('update');
				return node;
			},
			addToCluster: function (obj) {
				var node = this.getNode(obj.id),
					clusterNode = this.getNode('!cluster-' + this.nodes[node].group);
				this.createLink({ source: node, target: clusterNode, value: 0 });
			},
			removeFromCluster: function (obj) {
				var node = this.getNode(obj.id),
					clusterNode = this.getNode('!cluster-' + this.nodes[node].group),
					link = _.where(this.links, { source: node, target: clusterNode }).pop(),
					i = this.links.indexOf(link);
				//this.removeLink(this.links[i]);
			},
			remove: function (obj) {
				var i = this.getNode(obj.id);
				this.nodes.splice(i, 1);
				obj.off('change', this.update);
				this.removeLinks(obj);
				this.trigger('update');
			},
			getObjGroup: function (obj) {
				var keys = _.keys(obj.attributes),
					group = keys.sort().join('');
					i = this.groups.indexOf(group);
				if (i < 0) {
					i = this.groups.length;
					this.groups.push(group);
					this.nodes.push({ id: '!cluster-' + i, group: -1 });
				}
				return i;
			},
			updateLinkCache: function (obj) {
				var id = obj.id;
				delete this.linkCaches[id];
				return this.linkCaches[id] = getLinkedObjIds(obj.attributes);
			},
			updateLinks: function (obj) {
				var that = this,
					id = obj.id,
					node = this.getNode(id),
					linkCache = this.updateLinkCache(obj),
					nodes = this.nodes,
					links = this.links,

					linksTo = _.where(links, { target: node }),
					linksFrom = _.where(links, { source: node }),

					updatedToLinks = [],
					updatedFromLinks = [],

					createToLinks, removeToLinks,
					createFromLinks, removeFromLinks;

				console.log(node, this.nodes.length, this.links.length);

				_.each(this.linkCaches, function (targets, source) {
					if (targets.indexOf(id) > -1) {
						var sourceNode = that.getNode(source);
						if (sourceNode > -1) {
							updatedFromLinks.push({ source: sourceNode, target: node, value: 1 });
						}
					}
				});

				console.log(linkCache, updatedFromLinks);
				

				_.each(linkCache, function (target) {
					var targetNode = that.getNode(target);
					if (targetNode > -1) {
						updatedToLinks.push({ source: node, target: targetNode, value: 1 });
					}
				});

				removeToLinks = _.difference(linksTo, updatedToLinks);
				createToLinks = _.difference(updatedToLinks, linksTo);
				removeFromLinks = _.difference(linksFrom, updatedFromLinks);
				createFromLinks = _.difference(updatedFromLinks, linksFrom);


				//_.each([].concat(removeToLinks, removeFromLinks), this.removeLink, this);
				_.each([].concat(createToLinks, createFromLinks), this.createLink, this);

			},
			removeLinks: function (obj) {
				var id = obj.id,
					node = this.getNode(id),
					links = [].concat(
						_.where(this.links, { source: node }),
						_.where(this.links, { target: node }));
				_.each(links, this.removeLink, this);
			},
			removeLink: function (link) {
				var i = this.links.indexOf(link);
				this.links.splice(i, 1);
			},
			createLink: function (link) {
				this.links.push(link);
			},
			cluster: function () {

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
			},
			setClustering: function (clustering) {
				this.clustering = clustering;
			}
		});


		var initialize = function (box) {
			var objs = new Objs([], { box: box }),
				graph = new Graph({ objs: objs, clustering: true });
			
			$scope.objs = objs;
			$scope.options = { clustering: graph.clustering }

			$scope.$watch('options.clustering', function () {
				graph.setClustering($scope.options.clustering);
			});

			objs.fetch().then(function () {
				renderGraph(graph);
			});

			window.graph = graph;

			objs.on('add remove reset', function () {
				u.safeApply($scope);
			});

		};


				/*var objIds = _.pluck(this.nodes, 'id');

				this.links = this.reduce(function (links, obj) {
					var nodeA = objIds.indexOf(obj.id),
						linkedObjs = getLinkedObjs(obj.attributes);
					return links.concat(_.map(linkedObjs, function (obj) {
						var nodeB = objIds.indexOf(obj.id);
						return { source: nodeA, target: nodeB, value: 1 };
					}));
				}, []);*/
		var getLinkedObjIds = function (obj) {
			var ids = [];
			_.each(obj, function (v) {
				if (typeof v === "object") {
					if (v instanceof client.Obj) {
						ids.push(v.id);
					} else {
						ids = ids.concat(getLinkedObjIds(v));
					}
				}
			});
			return ids;
		};

		// watches the login stts for changes
		$scope.$watch('selectedBox + selectedUser', function() {
			if ($scope.selectedUser && $scope.selectedBox) {
				client.store.getBox($scope.selectedBox).then(function(box) {
					initialize(box);
				}).fail(function(e) { u.error('error ', e); });
			}
		});



		var renderGraph = function (graph) {

			var width = 960,
				height = 500;

			var color = d3.scale.category20();

			var zoom = d3.behavior.zoom()
				.scaleExtent([1, 10])
				.on("zoom", zoomed);

			var drag = d3.behavior.drag()
				.origin(function(d) { return d; })
				.on("dragstart", dragstarted)
				.on("drag", dragged)
				.on("dragend", dragended);

			var vis = d3.select("body").append("svg")
				.attr("width", "100%")
				.attr("height", "100%")
				.style("pointer-events", "all")
				.call(zoom);

			var container = vis.append("g");

			var force = d3.layout.force();


			var tip = d3.tip()
				.attr('class', 'd3-tip')
				.offset([-10, 0])
				.html(function (d) {
					return _.map(d.data, function (v, k) {
						return "<strong>" + k + ":</strong> " + v + "";
					}).join('<br>');
				});

			vis.call(tip);

			var update = function () {

				var nodes = force.nodes(graph.nodes),
					links = force.links(graph.links);

				var link = container.selectAll("line")
					.data(graph.links, function(d) {
						return d.source + "-" + d.target; 
					});

				link.enter().append("line")
					.attr("id", function (d) {return d.source + "-" + d.target; })
					.attr("class", "link")
					.style("stroke-width", function (d) { return Math.sqrt(d.value * 2); });;

				link.exit().remove();

				var node = container.selectAll("g.node")
					.data(graph.nodes, function (d) { return d.id; });

				var nodeEnter = node.enter().append("g")
					.attr("class", "node")
					.call(force.drag);

				nodeEnter.append("svg:circle")
					.attr("id",function (d) { return "Node;" + d.id; })
					.attr("r", 3.5)
					.style("fill", function (d) { return d.group < 0 ? 'transparent' : color(d.group); })
					.style("stroke", function (d) { return d.group < 0 ? 'transparent' : "#fff"; })
					.on('mouseover', tip.show)
					.on('mouseout', tip.hide);

/*
				node.append("title")
					.text(function (d) { return d.id; });*/

				/*nodeEnter.append("svg:text")
					.attr("class","textClass")
					.text( function(d){return d.id;}) ;*/

				node.exit().remove();

				force.on("tick", function() {
					link.attr("x1", function (d) { return d.source.x; })
						.attr("y1", function (d) { return d.source.y; })
						.attr("x2", function (d) { return d.target.x; })
						.attr("y2", function (d) { return d.target.y; });

					node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y         + ")"; });

				});

				// Restart the force layout.
				force
					.gravity(.15)
					.distance(20)
					.charge(-20)
					.linkDistance(30)
					.size([width, height])
					.start();
			};
			graph.on('update', update);

			update();


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
