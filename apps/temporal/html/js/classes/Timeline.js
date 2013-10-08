function Timeline(target)
{
	this.element = this.appendTemplate(target);
	InteractiveObject.call(this, this.element);
	this.graph = undefined;

	this.ioType = "Timeline";

	this.interval = 0;

	TimeUtils.setDateMinusDays(new Date(), 5, this);
	this.updateInterval();

	this.windowList = [];
	this.updateLastPosition();

	this.annotations = {};
}

Timeline.prototype = tEngine.clone(InteractiveObject.prototype);
Timeline.prototype.parent = InteractiveObject.prototype;

Timeline.prototype.constructor = InteractiveObject;


Timeline.prototype.initDays = function()
{
	this.weekday = new Array(7);
	this.weekday[0]="Sunday";
	this.weekday[1]="Monday";
	this.weekday[2]="Tuesday";
	this.weekday[3]="Wednesday";
	this.weekday[4]="Thursday";
	this.weekday[5]="Friday";
	this.weekday[6]="Saturday";

	var firstMoment = this.begin;
	var lastMoment  = this.end;


	this.updateDays();
}

Timeline.prototype.updateDays = function()
{
	var firstMoment = this.begin;
	var lastMoment  = this.end;

	var toMidnight = TimeUtils.toMidnight(firstMoment);
	var interval = TimeUtils.mostConvenientDayScale(this.interval);

	var moment;
	if(toMidnight > TimeUtils.hours(23))	
	{
		moment = Number(firstMoment)-(TimeUtils.days(1)-Number(toMidnight));
	}
	else
	{
		moment = Number(firstMoment)+Number(toMidnight);
	}

	this.days = [];
	while(moment < Number(lastMoment))
	{
		this.days.push(new Date(moment));
		moment += interval;
	}
}


Timeline.prototype.renderDays = function()
{
	var lastInstant  = this.end;
	var firstInstant = this.begin;

	var group = this.graph.selectAll(".days");
	var n = 0;
	group.each(function() { ++n; });

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.getWidth()]);

	if(n == 0)
	{
		group = this.graph.append("g").attr("class", "grid days");
	}

	group = group.selectAll("line").data(this.days);

	group.enter()
		.append("line")
		.attr("x1", x)
		.attr("y1", 0)
		.attr("x2", x)
		.attr("y2", 90)
		.attr("class", "timelineDay");

	group
		.attr("x1", x)
		.attr("x2", x);

	group.exit().remove();
}


Timeline.prototype.addGraph = function(graph)
{
	var window = new TimelineWindow(this.graph, graph, this);
	// tEngine.interactiveObjectList["timelineWindow"+graph.element.id] = window;
	this.windowList.push(window);
}

Timeline.prototype.removeGraph = function(graph)
{
	// delete tEngine.interactiveObjectList["timelineWindow"+graph.element.id];
	for(var index in this.windowList)
	{
		if(this.windowList[index].graph == graph)
		{
			this.windowList.splice(index, 1);
		}
	}
	this.render();
}

Timeline.prototype.init = function()
{
	this.initDays();
	this.graph = d3.select("#timeline .timelineGraph").append("svg:svg").attr("width", "100%").attr("height", "100%");
	this.renderGrid();
	this.renderLabels(this.graph);
}

Timeline.prototype.appendTemplate = function(target)
{
	target = d3.select(target);
	var graphDiv = target.append("div").attr("class", "timelineGraph");
	return graphDiv[0][0];
}

Timeline.prototype.updateInterval = function()
{
	this.interval = (this.end.valueOf()-this.begin.valueOf())/1000;
	this.updateDays();
}

Timeline.prototype.renderLabels = function(target)
{
	var lastInstant  = this.end;
	var firstInstant = this.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.getWidth()]);
	var labelGroup = target.selectAll(".label");

	n = 0;
	labelGroup.each(function() { ++n; });

	if(n == 0)
	{
		labelGroup = target.append("g").attr("class", "grid label").attr("transform", "translate(0,15)");
	}

	var labelList = [];

	for(var i in this.days)
	{
		labelList.push(new GraphText(this.weekday[this.days[i].getDay()], "graphDay", x(this.days[i])+2, 0));
		var timeStr = TimeUtils.dateFormatter(this.days[i], false);
		labelList.push(new GraphText(timeStr, "graphDay", x(this.days[i])+2, 70));
	}

	labelGroup = labelGroup.selectAll("text").data(labelList);
	
	labelGroup.enter()
		.append("text")
		.style("text-anchor", function(d) { return d.anchor; })
		.attr("class", function(d) { return d.style; })
		.attr("dx", function(d) { return d.x; } )
		.attr("dy", function(d) { return d.y; });

	labelGroup.transition()
		.duration(0)
		.style("text-anchor", function(d) { return d.anchor; })
		.attr("class", function(d) { return d.style; })
		.text(function(d) { return d.text; } )
		.attr("dx", function(d) { return d.x; } )
		.attr("dy", function(d) { return d.y; });

	labelGroup.exit().remove();
}

Timeline.prototype.addAnnotation = function(annotationID, activity)
{
	var aux = [];

	aux.begin = activity.instances[annotationID].begin;
	aux.end = activity.instances[annotationID].end;
	aux.activity = activity;
	aux.visible = false;

	this.annotations[annotationID] = aux;

	this.renderAnnotations();
}

Timeline.prototype.removeAnnotation = function(annotationID)
{
	delete this.annotations[annotationID];
}

Timeline.prototype.renderAnnotations = function()
{
	var x = d3.time.scale().domain([this.begin, this.end]).range([0, this.getWidth()]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.getHeight()-this.footerHeight]);

	this.graph.selectAll(".timelineAnnotations").remove();
	
	group = this.graph.append("g").attr("class", "timelineAnnotations");

	for(var i in this.annotations)
	{
		var instance = this.annotations[i];
		var mid = x(Number(instance.begin)+(Number(instance.end)-Number(instance.begin))/2);

		var points = mid+",35 "+(mid-7)+",20 "+(mid+7)+",20";
		group.append("polygon")
			.attr("points", points)
			.attr("class", "timelineAnnotation")
			.attr("opacity", function() {
				if(instance.activity.visible == true)
					return "0.9";
				else
					return "0.2";
			})
			.attr("fill",tEngine.getColor(instance.activity.color));
	}
}

Timeline.prototype.render = function()
{
	this.graph.selectAll(".window").remove();
	
	for(var i in this.windowList)
	{
		this.windowList[i].render();
	}
	this.renderAnnotations();
	this.renderGrid();
	this.renderLabels(this.graph);
}

Timeline.prototype.renderGrid = function ()
{
	var lastInstant  = this.end;
	var firstInstant = this.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.getWidth()]);
	var y = d3.scale.linear().domain([1, 0]).range([0, this.getHeight()]);

	var begin = TimeUtils.roundMinute(firstInstant);
	var end   = new Date(+(TimeUtils.roundMinuteUp(lastInstant)));

	var scale = TimeUtils.mostConvenientTimeScale(this.interval);
	var delta = begin % scale;

	begin -= delta;

	// var ticks = [];

	// for(var i=+(begin); i < +(end); i+=+(scale))
	// {
	// 	ticks.push(i);
	// }

	// var group = this.graph.selectAll(".interval");

	// var n = 0;
	// group.each(function() { ++n; });

	// if(n == 0)
	// {
	// 	group = this.graph.append("g").attr("class", "grid interval");
	// }

	// group = group.selectAll("line").data(ticks);
	
	// group.enter()
	// 	.append("line")
	// 	.attr("x1", x)
	// 	.attr("y1", 0)
	// 	.attr("x2", x)
	// 	.attr("y2", 90)
	// 	.attr("class", "tick");

	// group.transition()
	// 	.duration(0)
	// 	.attr("x1", x)
	// 	.attr("x2", x);

	// group.exit().remove();

	var ticks = [];
	ticks.push(0.5);

	group = this.graph.selectAll(".height");
	n = 0;
	group.each(function() { ++n; });

	if(n == 0)
	{
		group = this.graph.append("g").attr("class", "grid height");
	}

	group = group.selectAll("line").data(ticks);

	group.enter()
		.append("line")
		.attr("x1", 0)
		.attr("y1", y)
		.attr("x2", this.getWidth())
		.attr("y2", y)
		.attr("class", "axis");

	group.transition()
		.duration(0)
		.attr("y1", y)
		.attr("y2", y);

	group.exit().remove();
	this.renderDays();
}

Timeline.prototype.touchStarted = function(touch)
{
	for(var i in this.windowList)
	{
		if(tEngine.testCollision(touch.position, this.windowList[i]))
		{
			touch.setTarget(this.windowList[i]);
			this.windowList[i].touchStarted(touch);
		}
	}
}

Timeline.prototype.pan = function(touch, mouse, inverse, interval)
{


	if(tEngine.countTouchesObjectIsTarget(this) == 1 && this.dragging == false || typeof mouse !== "undefined")
	{
		if(typeof mouse === "undefined")
		{
			var delta = touch.lastPosition[0]-touch.position[0];
			this.panTime(delta*this.interval/this.getWidth()*1000);
		}
		else
		{
			this.panTime(-10*mouse*this.interval/this.getWidth()*1000);
		}
		this.updateInterval();
		this.render();
	}

}

Timeline.prototype.panTime = function(pan)
{
	var begin = new Date(this.begin.valueOf()+pan);
	var end = new Date(this.end.valueOf()+pan);

	var endLimit = new Date();

	if(+(end) <= +(endLimit))
	{
		this.begin = new Date(begin);
		this.end   = new Date(end);
	}
	else
	{
		var delta = end-endLimit;
		this.begin = new Date(begin-delta);
		this.end = new Date(endLimit);
	}
}

Timeline.prototype.pinch = function(touch, distance, angle)
{
	this.begin = new Date(this.begin.valueOf()-distance*50000);
	this.end = new Date(this.end.valueOf()+distance*50000);
	this.updateInterval();
	this.render();
}

