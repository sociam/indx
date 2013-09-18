function Graph(target, channel)
{
	var element = this.appendTemplate(target);
	InteractiveObject.call(this, element);
	this.annotations = {};
	this.unlabeledAnnotations = [];
	this.channel = channel;
	this.createdInterval = false;
	this.dataColor = channel.color;
	this.dataIdentifier = this.element.id;
	this.dataSource = this.channel.dataSource;
	this.days = undefined;
	this.graph = undefined;
	this.graphType = 0;
	this.heightProportion = 0.9;
	this.invertPan = false;
	this.isStatic = false;
	this.iType = "Graph";
	this.maxHorizontalTicks = 30;
	this.maxValue = 10;
	this.minValue = 0;
	this.readings = this.dataSource.readings;
	this.selectingInterval = false;
	this.selectedInterval = new GraphInterval(this);
	this.tempInterval = undefined;
	this.timeInterval = new TimeInterval();
	this.timeInterval.dataSource = this.dataSource;
	TimeUtils.setDateMinusDays(this.readings[this.readings.length-1].instant, TimeUtils.hours(6)/TimeUtils.days(1), this.timeInterval);
	this.timeInterval.buildDataInterval();
	
	this.panToEnd();
	this.initGraph();

	this.timelineLocked = true;
}

Graph.prototype = tEngine.clone(InteractiveObject.prototype);
Graph.prototype.parent = InteractiveObject.prototype;

Graph.prototype.constructor = InteractiveObject;

Graph.prototype.removeUnlabeled = function(annotation)
{
	for(var i=0; i < this.unlabeledAnnotations.length; i++)
	{
		if(this.unlabeledAnnotations[i] == annotation)
		{
			this.unlabeledAnnotations.splice(i, 1);
			break;
		}
	}
}

Graph.prototype.addUnlabeled = function(annotation) // can be improved
{
	for(var i=0; i < this.unlabeledAnnotations.length; i++)
	{
		if(this.unlabeledAnnotations[i] == annotation)
		{
			this.unlabeledAnnotations.splice(i, 1);
			break;
		}
	}
	this.unlabeledAnnotations.push(annotation);
}

Graph.prototype.addAnnotation = function(begin, end, activity, id)
{
	var indexBegin = this.timeInterval.indexForInstant(begin);
	var indexEnd = this.timeInterval.indexForInstant(end);

	var annotation = new Annotation(indexBegin, indexEnd, activity, this, id);
	this.annotations[annotation.annotationID] = annotation;
	return annotation;
}

Graph.prototype.removeAnnotation = function(id)
{
	if(typeof this.annotations[id] !== "undefined")
		this.annotations[id].destroy();
	delete this.annotations[id];
}

Graph.prototype.removeAnnotationPointer = function(id)
{
	delete this.annotations[id];
}

Graph.prototype.refreshTimeInterval = function()
{
	this.timeInterval.refreshData();
	this.selectedInterval.updateInfo();
	this.renderData();
}

Graph.prototype.appendTemplate = function(target)
{
	target = d3.select(target);
	var graphDiv = target.append("div").attr("id", "graph"+tEngine.lastGraphID++).attr("class", "aGraph");

	graphDiv.append("div").attr("class", "graph").attr("z-index", tEngine.lastGraphID);
	return graphDiv[0][0];
}

Graph.prototype.calculateMax = function()
{
	var max = -999999999;
	for(var i in this.readings)
	{
		if(max < this.readings[i].data)
		{
			max = +(this.readings[i].data);
		}
	}
	if(this.renderOtherData == true)
	{
		for(var i in this.otherData)
		{
			for(var j in this.otherData[i])
			{
				if(max < this.otherData[i][j])
					max = this.otherData[i][j];
			}
		}
	}
	this.maxValue = max;
}

Graph.prototype.calculateMin = function()
{
	var min = 0;

	for(var i in this.readings)
	{
		if(min > this.readings[i].data)
			min = this.readings[i].data;
	}
	if(this.renderOtherData == true)
	{
		for(var i in this.otherData)
		{
			for(var j in this.otherData[i])
			{
				if(min > this.otherData[i][j])
					min = this.otherData[i][j];
			}
		}
	}
	this.minValue = min;
}

Graph.prototype.sumData = function()
{
	if(this.otherData.length > 0)
	{
		var newData = [];
		var newDataIdentifier = "sum("+this.dataIdentifier;
		for(var i in this.data)
		{
			newData.push(this.data[i]);
			for(var j in this.otherData)
			{
				// console.log(i, this.otherData[j].length);
				if(i < this.otherData[j].length)
				{
					newData[i] = parseFloat(newData[i])+parseFloat(this.otherData[j][i]);
				}
			}
		}
		for(var i in this.otherDataIdentifier)
		{
			newDataIdentifier += ', '+this.otherDataIdentifier[i];
		}
		newDataIdentifier += ')';

		// console.log(this.derivedDataIdentifier);

		this.data = newData.slice(0);
		this.dataIdentifier = newDataIdentifier;
		this.dataColor = tEngine.pickColor();
		this.otherData = [];
		this.otherDataIdentifier = [];
		this.otherDataColor = [];
		// this.renderOtherData = false;
		this.calculateMax();
		this.calculateMin();
		this.redrawGraph();
	}
}

Graph.prototype.subtractData = function()
{
	if(this.otherData.length > 0)
	{
		var newData = [];
		var newDataIdentifier = "subtract("+this.dataIdentifier;
		for(var i in this.data)
		{
			newData.push(this.data[i]);
			for(var j in this.otherData)
			{
				// console.log(i, this.otherData[j].length);
				if(i < this.otherData[j].length)
				{
					newData[i] = parseFloat(newData[i])-parseFloat(this.otherData[j][i]);
				}
			}
		}
		for(var i in this.otherDataIdentifier)
		{
			newDataIdentifier += ', '+this.otherDataIdentifier[i];
		}
		newDataIdentifier += ')';

		// console.log(this.derivedDataIdentifier);

		this.data = newData.slice(0);
		this.dataIdentifier = newDataIdentifier;
		this.dataColor = tEngine.pickColor();
		this.otherData = [];
		this.otherDataIdentifier = [];
		this.otherDataColor = [];
		// this.renderOtherData = false;
		this.calculateMax();
		this.calculateMin();
		this.redrawGraph();
	}
}

Graph.prototype.mostConvenientDataScale = function(min, max)
{
	var delta = max-min;

	if(delta < this.maxHorizontalTicks)
	{
		return 1;
	}
	else if(delta/10 < this.maxHorizontalTicks)
	{
		return 10;
	}
	else if(delta/100 < this.maxHorizontalTicks)
	{
		return 100;
	} 
	else if(delta/1000 < this.maxHorizontalTicks)
	{
		return 1000;
	}
}

Graph.prototype.selectAnnotation = function(id)
{
	for(var index in this.annotations)
	{
		if(index == id)
		{
			this.annotations[index].select();
		}
		else
		{
			this.annotations[index].unselect();
		}
	}
}

Graph.prototype.initDays = function()
{
	var firstMoment = new Date(this.readings[0].instant);
	var lastMoment  = new Date(this.readings[this.readings.length-1].instant);

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

Graph.prototype.renderDays = function()
{
	var lastInstant  = this.timeInterval.end;
	var firstInstant = this.timeInterval.begin;

	var group = this.graph.selectAll(".days");
	var n = 0;
	group.each(function() { ++n; });

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.size[1]*this.heightProportion]);


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
		.attr("y2", this.size[1]*this.heightProportion)
		.attr("class", "day");

	group
		.attr("x1", x)
		.attr("x2", x);

	group.exit().remove();
}

Graph.prototype.renderGrid = function ()
{
	var lastInstant  = this.timeInterval.end;
	var firstInstant = this.timeInterval.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.size[1]*this.heightProportion]);

	var begin = TimeUtils.roundMinute(firstInstant);
	var end   = new Date(+(TimeUtils.roundMinuteUp(lastInstant)));

	var scale = TimeUtils.mostConvenientTimeScale(this.timeInterval.interval);
	var delta = begin % scale;

	begin -= delta;

	var ticks = [];

	for(var i=+(begin); i < +(end); i+=+(scale))
	{
		ticks.push(i);
	}
	ticks.push(i);

	var group = this.graph.selectAll(".interval");
	var n = 0;
	group.each(function() { ++n; });

	if(n == 0)
	{
		group = this.graph.append("g").attr("class", "grid interval");
	}
	
	var rects = group.selectAll("rect");
	rects.remove();

	for(var i=0;i<ticks.length-1;i++)
	{

		group.append("rect")
			.attr("x", x(ticks[i]))
			.attr("y", 0)
			.attr("width", x(ticks[i+1])-x(ticks[i])+"px")
			.attr("fill", tEngine.timeUtils.dayColor(ticks[i], tEngine.getColor(this.dataColor)))
			.attr("height", this.size[1]*this.heightProportion);
	}

	// group = group.selectAll("line").data(ticks);
	
	// group.enter()
	// 	.append("line")
	// 	.attr("x1", x)
	// 	.attr("y1", 0)
	// 	.attr("x2", x)
	// 	.attr("y2", this.size[1]*this.heightProportion)
	// 	.attr("class", "tick");


	// group
	// 	.attr("x1", x)
	// 	.attr("x2", x);

	// group.exit().remove();

	var ticks = [];
	
	var intVal = parseInt(this.minValue);
	var diff = this.minValue-parseInt;
	if(diff != 0) diff = 1;

	var scale = this.mostConvenientDataScale(this.minValue, this.maxValue);

	for(var i=parseInt(this.minValue)-diff; i < parseInt(this.maxValue)+1; i+=scale)
	{
		ticks.push(i);
	}

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
		.attr("class", function(d) 
			{ 
				if(d == 0) 
					return "axis";
				else
					return "tick";
			});

	group
		.attr("y1", y)
		.attr("y2", y);

	group.exit().remove();
	this.renderDays();
}


Graph.prototype.convertToBars = function()
{
	svg = d3.select("#"+this.element.id+" .graph svg");
	
	symbols = d3.nest()
      .key(function(d) { return d.symbol; })
      .entries(stocks = data);

	var x = d3.scale.linear().domain([0+this.panValue, 10+this.panValue]).range([0, this.zoom]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.size[1]]);
		
	var stack = d3.layout.stack()
      .values(function(d) { return d.values; })
      .x(function(d,i) { return d.date; })
      .y(function(d,i) { return d.price; })
      .out(function(d, y0, y) { d.price0 = y0; });
}

Graph.prototype.maxIndexRendered = function()
{
	return this.timeInterval.dataInterval[this.timeInterval.dataInterval.length-1].originalIndex;
}

Graph.prototype.initGraph = function()
{
	this.rescale();
	this.calculateMax();
	this.calculateMin();
	this.initDays();

	this.graph = d3.select("#"+this.element.id+" .graph").append("svg:svg").attr("width", "100%").attr("height", "100%");
	var thisGraph = this;
	this.graph.on("mousemove", function() 
	{ 
		thisGraph.mouseMove.call(thisGraph, d3.mouse(thisGraph.element));
	});

	if(this.graphType == 0)
	{
		this.renderLines(this.timeInterval.dataInterval, tEngine.getColor(this.dataColor), this.graph);
		this.renderLabels(this.graph);
	}
}

Graph.prototype.renderLines = function(readings, color, target, translateX)
{
	var lastInstant  = this.timeInterval.end;
	var firstInstant = this.timeInterval.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.size[1]*this.heightProportion]);

	
	var line = d3.svg.line()
		.x(function(d,i) { return x(d.instant); })
		.y(function(d,i) { return y(d.data); });

	this.renderGrid();
	target.selectAll("svg path").remove();

	var l = target.append("svg:path").attr("d", line(readings)).attr("stroke", color);
	if(typeof translateX !== "undefined")
	{
		l.attr("transform", "translate("+(-translateX)+",0)");
	}
}

Graph.prototype.renderLabels = function(target)
{
	var lastInstant  = this.timeInterval.end;
	var firstInstant = this.timeInterval.begin;

	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.size[0]]);
	var y = d3.scale.linear().domain([this.maxValue, this.minValue]).range([0, this.size[1]*this.heightProportion]);

	var labelGroup = target.selectAll(".label");

	n = 0;
	labelGroup.each(function() { ++n; });
	if(n == 0)
	{
		console.log("creating labels");
		labelGroup = target.append("g").attr("class", "grid label").attr("transform", "translate(0,15)");
	}

	var labelList = [];

	var beginStr = TimeUtils.dateFormatter(this.timeInterval.begin);
	var endStr = TimeUtils.dateFormatter(this.timeInterval.end);

	labelList.push(new GraphText(beginStr, "graphTimestamp", 0, 113));
	labelList.push(new GraphText(endStr, "graphTimestamp", 700, 113, "end"));

	var weekday=new Array(7);
	weekday[0]="Sunday";
	weekday[1]="Monday";
	weekday[2]="Tuesday";
	weekday[3]="Wednesday";
	weekday[4]="Thursday";
	weekday[5]="Friday";
	weekday[6]="Saturday";

	for(var i in this.days)
	{
		labelList.push(new GraphText(weekday[this.days[i].getDay()], "graphDay", x(this.days[i])+5, 0));
	}

	// labelList.push(new GraphText((this.maxValue).toFixed(2), "graphScale", 0, -5));

	labelGroup = labelGroup.selectAll("text").data(labelList);
	
	labelGroup.enter()
		.append("text")
		.style("text-anchor", function(d) { return d.anchor; })
		.attr("class", function(d) { return d.style; })
		.attr("dx", function(d) { return d.x; } )
		.attr("dy", function(d) { return d.y; });
		// .attr("class", "tick");

	labelGroup
		.text(function(d) { return d.text; } )
		.attr("class", function(d) { return d.style; })
		.attr("dx", function(d) { return d.x; } )
		.attr("dy", function(d) { return d.y; });

	labelGroup.exit().remove();
}

Graph.prototype.renderData = function()
{
	if(this.graphType == 0) // lines
	{

		this.renderLines(this.timeInterval.dataInterval, tEngine.getColor(this.dataColor), this.graph);
		this.renderLabels(this.graph);
	}

	if(this.selectingInterval == true)
	{
		this.selectedInterval.drawSelection();
	}
}

Graph.prototype.dragOver = function()
{
	// this.element.style.backgroundColor = "#efe";
}

Graph.prototype.update = function()
{
	// this.renderData();
	if(this.touchCount == 0)
	{
		this.element.style.backgroundColor = "#fff";
	}
	if(this.draggable == true)
	{
		if(this.positionLink != -1)
		{
			// console.log("dragging");
			// console.log(this.positionLink.touch.pageX, this.positionLink.touch.pageY)
			// console.log(this.element);
			this.updatePositionLink();
		}
		// for(x in this.animations)
		// {
		// 	this.animations[x].update();
		// }
	}
}

Graph.prototype.toGraphCoordinates = function(position)
{
	var pos = [];
	pos[0] = position[0]-this.position[0];
	pos[1] = position[1]-this.position[1];
	if(pos[0] < 0)
		pos[0] = 0;
	if(pos[1] < 0)
		pos[1] = 0;
	if(pos[0] > this.size[0])
		pos[0] = this.size[0];
	if(pos[1] > this.size[1])
		pos[1] = this.size[1];

	return pos;
}


Graph.prototype.changeGraphType = function (type)
{
	this.graphType = type;
	this.redrawGraph();
}



Graph.prototype.redrawGraph = function()
{
	var aux = this.findSVGGraph();
	// console.log(aux);
	if(aux != undefined)
	{
		// console.log("aux not null", aux);
		while (aux.firstChild) 
		{
			// console.log("hasChildren", aux.firstChild);
			aux.removeChild(aux.firstChild);
		}
	}
	
	this.renderData();
	// this.convertToBars();
}	

Graph.prototype.panToEnd = function()
{
	this.panValue = this.readings.length-0.5 - 10*this.size[0]/(this.zoom);
}

Graph.prototype.rescale = function()
{
	var dataPrevMin = this.panValue; // first data being rendered
	var dataPrevMax = this.panValue + 10*this.size[0]/(this.zoom); // last data being rendered
	var dataPrevMid = dataPrevMin+(dataPrevMax-dataPrevMin)/2; // data in the middle of the screen, I want to keep it static on the middle of the screen :)

	// this.zoom = this.lastZoom+parseFloat(distance)*1.5;
	// console.log(this.zoom);

	var minZoom = (10*this.size[0])/(this.readings.length-1);
	// console.log(minZoom);

	if(this.zoom < minZoom)
	{
		this.zoom = minZoom;
	}

	var pixelsLong = this.zoom*(this.readings.length/10); // how many pixels long the graph is at this zoom

	var dataMin = this.panValue; // first data being rendered
	var dataMax = this.panValue + 10*this.size[0]/(this.zoom); // new last data being rendered
	var dataMid = dataMin+(dataMax-dataMin)/2; // new data in the middle of the screen

	// console.log(dataMid-dataPrevMid);

	// this.panValue -= dataMid-dataPrevMid;

	if(dataMax > this.readings.length-1)
	{
		this.panValue = this.readings.length-1 - 10*this.size[0]/(this.zoom);
	}
	if(this.panValue < 0)
	{
		this.panValue = 0;
	}
}

Graph.prototype.generateRandomData = function(min, max, count)
{
	var random = 0;
	var randomData = [];
	
	for(var i=0;i<count;i++)
	{
		random = Math.random()*(max-min)+min;
		randomData.push(random);
	}
	return randomData;
}

Graph.prototype.findSVGGraph = function()
{
	// console.log(this.element.childNodes);
	for(var i in this.element.childNodes)
	{
		if(tEngine.isNumber(i))
		{
		// console.log(i+": ", this.element.childNodes[i].localName);
		if(this.element.childNodes[i].localName == "svg")
			return this.element.childNodes[i];
		}
	}
	return undefined;
}

Graph.prototype.updatePositionLink = function()
{
	var deltaMoved = this.positionLink.deltaMoved();
	this.updatePosition([this.position[0], this.lastPosition[1]+deltaMoved[1]]);
}

Graph.prototype.checkIfDataExistsInGraph = function(graph, identifier)
{
	// console.log(identifier);

	if(graph.dataIdentifier == identifier) return true;

	for(var i in graph.otherDataIdentifier) // check if this data isn't already on the otherData
	{
		if(graph.otherDataIdentifier[i] == identifier)
		{
			return true;
		}
	}
	return false;
}

Graph.prototype.updateData = function()
{
	// if(this.derivedData.length > 0)
	// {
	// 	this.data = this.derivedData;
	// 	this.dataIdentifier = this.derivedDataIdentifier;
	// 	this.otherData = [];
	// 	this.otherDataIdentifier = [];
	// 	this.derivedData = [];
	// 	this.derivedDataIdentifier = "";
	// 	// this.renderDerivedData = false;
	// 	// this.renderOtherData = false;
	// }
}

/////////////////////////////////////////////////////
//                  Events
/////////////////////////////////////////////////////

Graph.prototype.touchStarted = function(touch)
{
	if(tEngine.countTouchesObjectIsTarget(this) == 2) // pinch starting?
	{
		this.lastZoom = this.zoom;
	}
	tEngine.unselectAnnotations();
}

Graph.prototype.getFirstAnnotationAt = function(touch)
{
	var mousePos = touch.position;
	var annotation = undefined;
	for(var x in this.annotations)
	{
		if(mousePos[0] > this.annotations[x].position[0] && mousePos[0] < this.annotations[x].position[0]+this.annotations[x].size[0])
		{

		}
	}
	return annotation;
}

Graph.prototype.unselectAnnotations = function()
{
	for(var x in this.annotations)
	{
		this.annotations[x].unselect();
	}
	for(var x in this.unlabeledAnnotations)
	{
		this.unlabeledAnnotations[x].unselect();
	}
}

Graph.prototype.touchEnded = function(touch)
{
	this.backToNormal();
	this.invertPan = false;
		d3.select(this.element)
		.style("cursor", "auto");
	// console.log("touchEnded");
	this.selectingInterval = false;

	// var position = tEngine.getListPosition(this);
	var position = 0;

	this.element.style.opacity = 1;

	this.selectedInterval.validateOrder();
    
	if(this.positionLink != -1)
	{
		tEngine.updateGraphsPosition();
	}
	if(this.link != -1)
	{
		// console.log("dropped!");
		if(this.link != this.cloneOf)
		{
			var alreadyThere = this.checkIfDataExistsInGraph(this.link, this.dataIdentifier);
			if(alreadyThere == false)
			{
				this.link.otherData.push(this.data.slice(0)); 
				this.link.otherDataIdentifier.push(this.dataIdentifier);
				this.link.otherDataColor.push(this.dataColor);
			}

			for(var i in this.otherData)
			{
				if(!this.checkIfDataExistsInGraph(this.link, this.otherDataIdentifier[i]))
				{
					this.link.otherData.push(this.otherData[i].slice(0)); 
					this.link.otherDataIdentifier.push(this.otherDataIdentifier[i]);
					this.link.otherDataColor.push(this.otherDataColor[i]);
				}
			}
			this.link.calculateMax();
			this.link.calculateMin();
			this.link.redrawGraph();
			// console.log(this.link.otherDataSource);
		}
	}

	this.unbindPosition();
	if(this.destroyOnRelease == true)
	{
		this.draggable = false;
		var animation = new Animation(this.element.style);
		animation.animatedProperty = "opacity";
		animation.animateFrom = 0.7;
		animation.animateTo = 0.0;
		animation.duration = 300;
		animation.unit = "";
		animation.varType = "float";
		animation.elementOwner = this;
		animation.callbackFunction = this.suicide;
		animation.start();
		// console.log(animation);

		this.animations.push(animation);
	}
}

Graph.prototype.hold = function(touch)
{
	if(tEngine.keyMap[16] == false)
	{
		// console.log("hold");
		d3.select(this.element)
			.style("z-index", tEngine.lastZIndex++)
			.style("background-color", "#ddd")
			.style("cursor", "move");
		if(this.draggable == true)
		{
				this.bindPositionToTouch(touch);

		}
	}
}


Graph.prototype.swipe = function(touch)
{
	// console.log("swipe");
}

Graph.prototype.swipeRight = function(touch)
{
	// console.log("swipeRight");
}

Graph.prototype.swipeLeft = function(touch)
{
	// console.log("swipeLeft");
}

Graph.prototype.swipeUp = function(touch)
{
	// console.log("swipeUp");
}

Graph.prototype.swipeDown = function(touch)
{
	// console.log("swipeDown");
}

Graph.prototype.xForIndex = function(index)
{
	// var firstData = this.panValue;
	// var lastData = this.panValue + 10*this.size[0]/(this.zoom);

	// var delta = lastData-firstData;

	// return (index - firstData) * (this.size[0]/delta);
	return this.timeInterval.xForIndex(index, this.size[0]);
}

Graph.prototype.indexForX = function(x)
{
	// var dataMin = this.panValue; // first data being rendered
	// var dataMax = this.panValue + 10*this.size[0]/(this.zoom); // last data being rendered

	// var delta = dataMax - dataMin;

	// return dataMin+(x)*(dataMax-dataMin)/this.size[0];
	return this.timeInterval.indexForX(x, this.size[0]);
}

Graph.prototype.updateAnnotations = function()
{
	this.selectedInterval.update();

	for(var x in this.annotations)
	{
		this.annotations[x].update();
	}
	for(var x in this.unlabeledAnnotations)
	{
		this.unlabeledAnnotations[x].update();
	}
}

Graph.prototype.pan = function(touch, mouse, inverse, interval) // mouse is a variable that allows to pan using the magic mouse gestures
{
	// panning
	if(tEngine.countTouchesObjectIsTarget(this) == 1 && this.dragging == false && tEngine.keyMap[16] == false || typeof mouse !== "undefined")
	{

		if (typeof interval === "undefined") 
		{		
			if(this.invertPan == true)
				interval = this.tempInterval;
			else
				interval = this.timeInterval.interval;
		}
		else
		{
			this.tempInterval = interval;
		}
		if(typeof mouse === "undefined")
		{
			var delta = (touch.lastPosition[0]-touch.position[0])*interval/this.size[0]*1000;
			if(this.invertPan == true)
				delta = -delta;
			
			if(this.timelineLocked == false)
			{
				this.timeInterval.pan(delta);
				this.refreshTimeInterval();
			}
			else
			{
				tEngine.panLocked(delta, this.dataSource.source);
			}
		}
		else
		{
			var delta = -10*mouse*interval/this.size[0]*1000;
			if(this.invertPan == true)
				delta = -delta;

			if(this.timelineLocked == false)
			{
				this.timeInterval.pan(delta);
				this.refreshTimeInterval();
			}
			else
			{
				tEngine.panLocked(delta, this.dataSource.source);
			}
		}

		this.selectedInterval.resetInterval();
		this.updateAnnotations();
		this.selectedInterval.updateSelection();

		this.redrawGraph();
		tEngine.timeline.render();
	} 
	// selecting interval
	else if(tEngine.countTouchesObjectIsTarget(this) == 1 && this.dragging == false && tEngine.keyMap[16] == true && this.invertPan != true)
	{
		var pos = this.toGraphCoordinates(touch.position);

		var xPercentage = pos[0]/this.size[0];

		var dataMin = this.panValue; // first data being rendered
		var dataMax = this.panValue + 10*this.size[0]/(this.zoom); // last data being rendered

		var delta = dataMax - dataMin;

		var posIndex = this.indexForX(pos[0]);
		// console.log(posIndex);
		pos = this.xForIndex(posIndex);

		if(this.selectingInterval == false)
		{
			this.selectedInterval.resetInterval();
			this.selectedInterval.interval.indexBegin = posIndex;
			this.selectedInterval.interval.indexEnd = posIndex-1;
			this.selectedInterval.interval.begin = pos;
			this.selectedInterval.interval.end = this.xForIndex(posIndex-1);

			this.selectingInterval = true;
			// console.log(this.selectedInterval.interval.indexBegin);
		}
		else if(this.invertPan != true)
		{
			if(Math.abs(this.selectedInterval.interval.indexBegin-posIndex) > 0)
			{
				this.selectedInterval.interval.indexEnd = posIndex;
				this.selectedInterval.interval.end = pos;
			}

			// console.log(this.selectedInterval.interval.indexEnd);
		}
		// tEngine.clearDebug();
		// var date = new Date(timePos);
		// tEngine.debug(date.toString());
		this.selectedInterval.updateSelection();
		this.redrawGraph();
		this.updateAnnotations();
		if(this.selectingInterval == true)
		{
			this.selectedInterval.drawSelection();
		}
	}
	else if(touch.over.length > 1) // hovering other thing
	{
		// this.link = -1;
		// for(var x in touch.over)
		// {
		// 	var t = touch.over[x];
		// 	if(t.element.id != this.element.id)
		// 	{
		// 		if(t.iType == "Graph")
		// 		{
		// 			t.dragOver();
		// 			this.link = t;
		// 		}
		// 	}
		// }
		var cursorPos = tEngine.cursorPosition;
		tEngine.repositionGraphsToFitGraph(this);
	}
}

Graph.prototype.pinch = function(touch, distance, angle, mouse)
{
	// console.log("pinch");
	if(this.dragging == false)
	{
		if(typeof mouse === "undefined")
		{
			mouse = false;
		}
		this.cancelHold = true;
		// console.log("pinch");

		if(this.timelineLocked == false)
		{
			this.timeInterval.pinch(distance*10000);
		}
		else
		{
			tEngine.pinchLocked(distance*10000, this.dataSource.source);
		}

		var dataPrevMin = this.panValue; // first data being rendered
		var dataPrevMax = this.panValue + 10*this.size[0]/(this.zoom); // last data being rendered
		var dataPrevMid = dataPrevMin+(dataPrevMax-dataPrevMin)/2; // data in the middle of the screen, I want to keep it static on the middle of the screen :)

		var dataMin = this.panValue; // first data being rendered
		var dataMax = this.panValue + 10*this.size[0]/(this.zoom); // new last data being rendered
		var dataMid = dataMin+(dataMax-dataMin)/2; // new data in the middle of the screen

		this.panValue -= dataMid-dataPrevMid;

		if(dataMax > this.readings.length-0.5)
		{
			this.panValue = this.readings.length-0.5 - 10*this.size[0]/(this.zoom);
		}
		if(this.panValue < 0)
		{
			this.panValue = 0;
		}
		this.updateAnnotations();
	}
	this.redrawGraph();	
}

Graph.prototype.mouseMove = function(pos)
{
	// console.log("mouseMove", pos);
	this.graph.selectAll(".crosshair").remove();

	var lastInstant  = this.timeInterval.end;
	var firstInstant = this.timeInterval.begin;

	var x = pos[0]/(this.size[0]-2) * (Number(lastInstant)-Number(firstInstant)) + Number(firstInstant);
	var invY = d3.scale.linear().domain([0, this.size[1]*this.heightProportion]).range([this.maxValue, this.minValue]);

	var crosshair = this.graph.append("g").attr("class", "crosshair");

	var inc = pos[1] > this.size[1]/2 ? -5 : 12;

	var dateText = new GraphText(TimeUtils.dateFormatter(x), "dateText", pos[0], 10, pos[0] < this.size[0]/2 ? undefined : "end");
	var valueText = new GraphText(invY(pos[1]).toFixed(2), "valueText", this.size[0]-5, pos[1]+inc, "end");

	if(pos[1] < this.size[1]*this.heightProportion)
	{
		crosshair.append("line")
			.attr("x1", 0)
			.attr("y1", pos[1])
			.attr("x2", this.size[0])
			.attr("y2", pos[1])
			.attr("class", "hCrosshair");

		crosshair.append("text")
			.text(valueText.text)
			.style("text-anchor", valueText.anchor)
			.attr("class", valueText.style)
			.attr("dx", valueText.x)
			.attr("dy", valueText.y);
	}

	crosshair.append("line")
		.attr("x1", pos[0])
		.attr("y1", 0)
		.attr("x2", pos[0])
		.attr("y2", this.size[1]*this.heightProportion)
		.attr("class", "vCrosshair");

	crosshair.append("text")
		.text(dateText.text)
		.style("text-anchor", dateText.anchor)
		.attr("class", dateText.style)
		.attr("dx", dateText.x)
		.attr("dy", dateText.y);
}
