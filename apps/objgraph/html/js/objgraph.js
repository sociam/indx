/* global angular, console, _, Backbone, $ */
angular
	.module('objgraph', ['ui', 'indx'])
	.factory('ObjsFactory', function () {
		var Objs = Backbone.Collection.extend({
			initialize: function (attributes, options) {
				if (options && options.box) { this.setBox(options.box); }
			},
			fetch: function () {
				var that = this,
					promise = $.Deferred(),
					ids = this.box.getObjIDs();
				that.box.getObj(ids).then(function (objs) {
					console.log(_.map(objs, function (obj) { return obj.toJSON(); }))
					that.reset(objs);
					promise.resolve();
				});
				return promise;
			},
			setBox: function (box) {
				var that = this;
				this.box = box;
				that.box.on('all', function (e) {
					console.log(e, arguments)
				});
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
				return this;
			}
		});

		return Objs;
	})
	.factory('GraphModelFactory', function (client) {
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
				//this.links.splice(0, this.links.length);
				this.queue = [];
				this.groups = [];
				this.linkCaches = {}; // obj_id -> [obj_id, obj_id, ...]

				this.add(this.objs.models);
			},
			getNode: function (id) {
				var node = _.where(this.nodes, { id: id }).pop();
				return this.nodes.indexOf(node);
			},
			add: function (obj) {
				if (_.isArray(obj)) {
					this.queue = this.queue.concat(obj);
				} else {
					this.queue.push(obj);
				}
				this.pushQueue();
			},
			pushQueue: _.throttle(function () {
				var that = this;
				this.queue.forEach(function (obj) {
					var node = { obj: obj };
					that.nodes.push(node);
					that.update(node, obj, true);
					obj.on('change', function () {
						that.update(node, obj);
					});
				});
				this.trigger('update');
				this.queue = [];
			}, 100),
			update: function (node, obj, silent) {
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
				if (!silent) {
					this.trigger('update');
				}
				return node;
			},
			addToCluster: function (obj) {
				var node = this.getNode(obj.id),
					clusterName = this.nodes[node].group,
					clusterNode;
				if (clusterName) {
					clusterNode = this.getNode('!cluster-' + clusterName);
					this.createLink({ source: node, target: clusterNode, value: 0 });
				}
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

				if (this.groups.indexOf(group) < 0) {
					this.groups.push(group);
					this.nodes.push({ id: '!cluster-' + group, group: -1 });
				}

				return group;
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

					// links from other nodes to this node
					existingLinksTo = _.where(links, { target: node }),
					// links to other nodes from this node
					existingLinksFrom = _.where(links, { source: node }),

					allLinksTo = [],
					allLinksFrom = [],

					createLinksTo, removeToLinks,
					createLinksFrom, removeFromLinks;

				_.each(this.linkCaches, function (targets, source) {
					if (targets.indexOf(id) > -1) {
						var sourceNode = that.getNode(source);
						if (sourceNode > -1) {
							allLinksFrom.push({ source: sourceNode, target: node, value: 1 });
						}
					}
				});
				

				_.each(linkCache, function (target) {
					var targetNode = that.getNode(target);
					if (targetNode > -1) {
						allLinksTo.push({ source: node, target: targetNode, value: 1 });
					}
				});

				//removeToLinks = _.difference(existingLinksTo, allLinksTo);
				//createLinksTo = _.difference(allLinksTo, existingLinksTo);
				//removeFromLinks = _.difference(existingLinksFrom, allLinksFrom);
				//createLinksFrom = _.difference(allLinksFrom, existingLinksFrom);

				//_.each([].concat(removeToLinks, removeFromLinks), this.removeLink, this);
				//this.links.splice(0, this.links.length);
				_.each([].concat(this.links, allLinksTo, allLinksFrom), this.createLink, this);

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
				//this.links.splice(i, 1);
			},
			createLink: function (link) {
				if (_(this.links).where(link).length === 0) {
					this.links.push(link);
				}
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
						//links.push({ source: nodeA, target: nodeB, value: 0 });
					});
				});
			},
			setClustering: function (clustering) {
				this.clustering = clustering;
			},
			getNodes: function () {
				return _.map(this.nodes, function (node) {
					return _.clone(node);
				});
			},
			getLinks: function () {
				return _.map(this.links, function (link) {
					return _.clone(link);
				});
			}
		});

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

		return Graph;
	})
	.factory('GraphFactory', function () {
		var width = 960,
			height = 500;

		var colors = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', 
				'#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b',
				'#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', 
				'#dbdb8d', '#17becf', '#9edae5'],
			color = function (str) {
				return colors[_(str.split('')).reduce(function (m, c) {
					return m + c.charCodeAt(0);
				}, 0) % colors.length];
			};

		var Graph = Backbone.View.extend({
			initialize: function (options) {
				this.graph = options.graphModel;
				this.element = options.element;
				this.graph.on('update', this.update, this);
				this.render();
			},
			render: function () {
				var that = this;
				var zoom = d3.behavior.zoom()
					.scaleExtent([1, 10])
					.on("zoom", function () {
						that.container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
					});

				var drag = d3.behavior.drag()
					.origin(function(d) { return d; })
					.on("dragstart", dragstarted)
					.on("drag", dragged)
					.on("dragend", dragended);

				var vis = d3.select(this.element).append("svg")
					.attr("width", "100%")
					.attr("height", "100%")
					.style("pointer-events", "all")
					.call(zoom);

				this.container = vis.append("g");

				this.force = d3.layout.force();

				this.tip = d3.tip()
					.attr('class', 'd3-tip')
					.offset([-10, 0])
					.html(function (d) {
						return _.map(d.data, function (v, k) {
							return "<strong>" + k + ":</strong> " + v + "";
						}).join('<br>');
					});

				vis.call(this.tip);
				this.update();
			},
			update: function () {
				var that = this,
					graphNodes = this.graph.nodes,
					graphLinks = this.graph.getLinks(),
					nodes = this.force.nodes(graphNodes),
					links = this.force.links(graphLinks);

				var node = this.container.selectAll("g.node")
					.data(graphNodes, function (d) { return d.id; });

				var nodeEnter = node.enter().append("g")
					.attr("class", "node")
					.call(this.force.drag);

				nodeEnter.append("svg:circle")
					.attr("id",function (d) { return "Node;" + d.id; })
					.attr("r", 3.5)
					.style("fill", function (d) { return d.group < 0 ? 'transparent' : color(d.group); })
					.style("stroke", function (d) { return d.group < 0 ? 'transparent' : "#fff"; })
					.on('mouseover', this.tip.show)
					.on('mouseout', this.tip.hide)
					.on('click', function (d) { that.trigger('select', d.obj); });

/*
				node.append("title")
					.text(function (d) { return d.id; });*/

				/*nodeEnter.append("svg:text")
					.attr("class","textClass")
					.text( function(d){return d.id;}) ;*/

				node.exit().remove();

				var link = this.container.selectAll("line")
					.data(graphLinks, function (d) {
						console.log(d.source + "-" + d.target, d)
						return d.source + "-" + d.target;  /// HACK
					});

				link.enter().append("line")
					.attr("id", function (d) { return d.source.index + "-" + d.target.index; })
					.attr("class", "link")
					.style("stroke-width", function (d) { return Math.sqrt(d.value * 2); });;

				link.exit().remove();

				this.force.on("tick", function() {
					link.attr("x1", function (d) { return d.source.x; })
						.attr("y1", function (d) { return d.source.y; })
						.attr("x2", function (d) { return d.target.x; })
						.attr("y2", function (d) { return d.target.y; });

					node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y         + ")"; });

				});

				// Restart the force layout.
				this.force
					.gravity(.02)
					.distance(30)
					.charge(-20)
					.linkDistance(20)
					.size([width, height])
					.start();
			}
		});
		var dragstarted = function (d) {
			d3.event.sourceEvent.stopPropagation();
			d3.select(this).classed("dragging", true);
		};

		var dragged = function (d) {
			d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
		};

		var dragended = function (d) {
			d3.select(this).classed("dragging", false);
		};

		return Graph;
	})
	.controller('root', function ($scope, client, utils, ObjsFactory, GraphModelFactory, GraphFactory) {
		'use strict';

		var box,
			u = utils,
			objs = new ObjsFactory(),
			graphModel = new GraphModelFactory({ objs: objs, clustering: false }),
			graph = new GraphFactory({ graphModel: graphModel, element: '.vis-container' });

		$scope.objs = objs;
		$scope.options = { clustering: graphModel.clustering }

		$scope.$watch('options.clustering', function () {
			graphModel.setClustering($scope.options.clustering);
		});

		objs.on('add remove reset', function () {
			$update();
		});

		graph.on('select', function (obj) {
			$scope.s.selectedObj = obj;
			$update();
		})

		$scope.$watch('selectedBox + selectedUser', function () {
			delete $scope.msg;
			if (!$scope.selectedUser) {
				$scope.msg = 'Please log in.';
			} else if (!$scope.selectedBox) {
				$scope.msg = 'Please select a box.';
			} else {
				client.store.getBox($scope.selectedBox)
					.then(function (box) { init(box); })
					.fail(function (e) { u.error('error ', e); $scope.msg = 'An error occured.'; });
			}
			
		});

		var init = function (box) {
			window.box = box;
			window.objs = objs;
			objs.setBox(box).fetch();
		};
		var $update = function () {
			u.safeApply($scope);
		};
		$scope.s = {
			page: 0,
			orderBy: 'id',
			orderReverse: false,
			perPage: 15
		}; // state
		$scope.Math = window.Math;

		/*var objIds = _.pluck(this.nodes, 'id');

		this.links = this.reduce(function (links, obj) {
			var nodeA = objIds.indexOf(obj.id),
				linkedObjs = getLinkedObjs(obj.attributes);
			return links.concat(_.map(linkedObjs, function (obj) {
				var nodeB = objIds.indexOf(obj.id);
				return { source: nodeA, target: nodeB, value: 1 };
			}));
		}, []);*/
		


	}).filter('startFrom', function() {
		return function (input, start) {
			start = +start; //parse to int
			return input.slice(start);
		}
	});
