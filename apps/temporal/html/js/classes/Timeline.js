function Timeline(target)
{
	this.element = this.appendTemplate(target);
	InteractiveObject.call(this, this.element);
	this.graph = undefined;

	this.iType = "Timeline";

	this.interval = 0;

	TimeUtils.setDateMinusDays(new Date(), 5, this);
	this.updateInterval();

	this.init();

	this.windowList = [];
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

	// console.log(firstMoment, lastMoment);

	var toMidnight = TimeUtils.toMidnight(firstMoment);
	var day = TimeUtils.days(1);

	var moment = Number(firstMoment)+Number(toMidnight);

	this.days = [];
	while(moment < Number(lastMoment))
	{
		this.days.push(new Date(moment));
		moment += day;
	}
}

Timeline.prototype.updateDays = function()
{
	var firstMoment = this.begin;
	var lastMoment  = this.end;

	var toMidnight = TimeUtils.toMidnight(firstMoment);
	var day = TimeUtils.days(1);

	var moment = Number(firstMoment)+Number(toMidnight);

	this.days = [];
	while(moment < Number(lastMoment))
	{
		this.days.push(new Date(moment));
		moment += day;
	}
}


Timeline.prototype.renderDays = function()
{
	var lastInstant  = this.end;
	var firstInstant = this.begin;

	var group = this.graph.selectAll(".days");
	var n = 0;
	group.each(function() { ++n; });

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);

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
	tEngine.interactiveObjectList["timelineWindow"+graph.element.id] = window;
	this.windowList.push(window);
}

Timeline.prototype.removeGraph = function(graph)
{
	delete tEngine.interactiveObjectList["timelineWindow"+graph.element.id];
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

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var labelGroup = target.selectAll(".label");

	n = 0;
	labelGroup.each(function() { ++n; });

	if(n == 0)
	{
		labelGroup = target.append("g").attr("class", "grid label").attr("transform", "translate(0,15)");
	}

	var labelList = [];

	// var beginStr = TimeUtils.dateFormatter(this.begin);
	// var endStr = TimeUtils.dateFormatter(this.end);

	// labelList.push(new GraphText(beginStr, "timelineTimestamp", 0, 0));
	// labelList.push(new GraphText(endStr, "timelineTimestamp", 700, 0, "end"));

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
		// .attr("class", "tick");

	labelGroup.transition()
		.duration(0)
		.style("text-anchor", function(d) { return d.anchor; })
		.attr("class", function(d) { return d.style; })
		.text(function(d) { return d.text; } )
		.attr("dx", function(d) { return d.x; } )
		.attr("dy", function(d) { return d.y; });

	labelGroup.exit().remove();
}

Timeline.prototype.render = function()
{
	this.graph.selectAll(".window").remove();
	
	for(var i in this.windowList)
	{
		this.windowList[i].render();
	}

	this.renderGrid();
	this.renderLabels(this.graph);
}

Timeline.prototype.renderGrid = function ()
{
	var lastInstant  = this.end;
	var firstInstant = this.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var y = d3.scale.linear().domain([1, 0]).range([0, this.size[1]]);

	var begin = TimeUtils.roundMinute(firstInstant);
	var end   = new Date(+(TimeUtils.roundMinuteUp(lastInstant)));

	var scale = TimeUtils.mostConvenientTimeScale(this.interval);
	var delta = begin % scale;

	begin -= delta;

	var ticks = [];

	for(var i=+(begin); i < +(end); i+=+(scale))
	{
		ticks.push(i);
	}

	var group = this.graph.selectAll(".interval");
	

	var n = 0;
	group.each(function() { ++n; });

	if(n == 0)
	{
		group = this.graph.append("g").attr("class", "grid interval");
	}

	group = group.selectAll("line").data(ticks);
	
	group.enter()
		.append("line")
		.attr("x1", x)
		.attr("y1", 0)
		.attr("x2", x)
		.attr("y2", 90)
		.attr("class", "tick");

	group.transition()
		.duration(0)
		.attr("x1", x)
		.attr("x2", x);

	group.exit().remove();

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
		.attr("x2", this.size[0])
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
	// console.log("touchStarted");
}

Timeline.prototype.touchEnded = function(touch)
{
	// console.log("touchEnded");
}

Timeline.prototype.hold = function(touch)
{
	// console.log("hold");
}

Timeline.prototype.swipe = function(touch)
{
	// console.log("swipe");
}
Timeline.prototype.swipeRight = function(touch)
{
	// console.log("swipeRight");
}
Timeline.prototype.swipeLeft = function(touch)
{
	// console.log("swipeLeft");
}
Timeline.prototype.swipeUp = function(touch)
{
	// console.log("swipeUp");
}
Timeline.prototype.swipeDown = function(touch)
{
	// console.log("swipeDown");
}
Timeline.prototype.pan = function(touch, mouse, inverse, interval)
{
	if(tEngine.countTouchesObjectIsTarget(this) == 1 && this.dragging == false || typeof mouse !== "undefined")
	{
		if(typeof mouse === "undefined")
		{
			var delta = touch.lastPosition[0]-touch.position[0];
			this.panTime(delta*this.interval/this.size[0]*1000);
		}
		else
		{
			// console.log(-10*mouse*this.interval/this.size[0]*1000);
			this.panTime(-10*mouse*this.interval/this.size[0]*1000);
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
	// console.log("pinch", distance)
	this.begin = new Date(this.begin.valueOf()-distance*5000);
	this.end = new Date(this.end.valueOf()+distance*5000);
	this.updateInterval();
	this.render();
}

