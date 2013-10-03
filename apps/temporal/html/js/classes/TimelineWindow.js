function TimelineWindow(target, graph, timeline)
{
	this.element = undefined;

	this.renderTarget = target;
	this.graph = graph;
	this.timeline = timeline;

	this.size = [];

	this.init();
	InteractiveObject.call(this, this.element);
	this.ioType = "TimelineWindow";

	this.isSVG = true;
	this.updateLastPosition();
}

TimelineWindow.prototype = tEngine.clone(InteractiveObject.prototype);
TimelineWindow.prototype.parent = InteractiveObject.prototype;

TimelineWindow.prototype.constructor = InteractiveObject;

TimelineWindow.prototype.update = function()
{
	
}

TimelineWindow.prototype.init = function()
{
	var lastInstant  = this.timeline.end;
	var firstInstant = this.timeline.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.timeline.getWidth()]);
	var y = d3.scale.linear().domain([1, 0]).range([0, this.timeline.getHeight()]);

	var group = this.renderTarget.append("g").attr("class", "window");	

	var width = x(this.graph.timeInterval.end)-x(this.graph.timeInterval.begin);
	var height = 50;

	var element = group.append("rect")
		.attr("x", x(this.graph.timeInterval.begin))
		.attr("y", 20)
		.attr("width", width)
		.attr("fill", tEngine.getColor(this.graph.dataColor))
		.attr("height", height);

	this.element = element[0][0];

	this.setWidth(width);
	this.setHeight(height);
	this.sizeCached = true;
}

TimelineWindow.prototype.render = function()
{
	var lastInstant  = this.timeline.end;
	var firstInstant = this.timeline.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.timeline.getWidth()]);
	var y = d3.scale.linear().domain([1, 0]).range([0, this.timeline.getHeight()]);

	var group = this.renderTarget.append("g").attr("class", "window");

	var width = x(this.graph.timeInterval.end)-x(this.graph.timeInterval.begin);
	var height = 30;

	var element = group.append("rect")
		.attr("x", x(this.graph.timeInterval.begin))
		.attr("y", 40)
		.attr("width", width)
		.attr("fill", tEngine.getColor(this.graph.dataColor))
		.attr("height", height);

	this.element = element[0][0];

	this.setWidth(width);
	this.setHeight(height);
}

TimelineWindow.prototype.pan = function(touch)
{
	this.graph.invertPan = true;
	touch.setTarget(this.graph);
	if(this.graph.pannable == true)
		this.graph.pan(touch, undefined, true, this.timeline.interval);
}