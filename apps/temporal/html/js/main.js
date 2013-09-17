function TemporalEngine()
{
	this.interactiveObjectList = [];
	this.touchList = [];
	this.logSize = 0;
	this.dragEnabled = false;
	this.framerate = 60;
	this.lastZIndex = 100;
	this.lastColor = 0;
	this.lastAnnotationID = 0;


	this.graphListElement = undefined;

	this.debugFlag = false;

	this.graphList = {};

	this.channelMap = {};

	this.colorArray = [];

	this.initColors();

	this.keyMap = [];
	this.keyMap[16] = false;

	this.cursorPosition = [];

	this.lastGraphID = 0;

	this.animationDuration = 200;

	this.pckry = undefined;

	this.timeline = undefined;
	this.sourcesLoaded = 0;
	this.totalSources = 0;

	this.activityMap = {};
}

TemporalEngine.prototype.getInstancesForAnnotationID = function(id)
{
	var annotation = {};
	for(var x in this.graphList)
	{
		annotation[this.graphList[x].graph.channel.name] = this.graphList[x].graph.annotations[id];
	}
	return annotation;
}

TemporalEngine.prototype.addAnnotationToGraphs = function(annotationID, activity, origin)
{
	for(var x in this.graphList)
	{
		if(this.graphList[x].graph != origin)
		{
			var annotation = this.graphList[x].graph.addAnnotation(activity.instances[annotationID].begin, activity.instances[annotationID].end, activity, annotationID);
			annotation.unselect();
		}
	}
}

TemporalEngine.prototype.addAnnotationToGraph = function(annotationID, activity, graph)
{
	var annotation = graph.addAnnotation(activity.instances[annotationID].begin, activity.instances[annotationID].end, activity, annotationID);
	annotation.unselect();
}

TemporalEngine.prototype.removeAnnotationFromGraphs = function(annotationID, origin)
{
	for(var x in this.graphList)
	{
		if(this.graphList[x].graph != origin)
		{
			this.graphList[x].graph.removeAnnotation(annotationID);
		}
	}
}

TemporalEngine.prototype.updateActivityList = function()
{
	var activityList = [];
	for(var x in this.activityMap)
	{
		activityList.push(this.activityMap[x]);
	}

	var activities = d3.select("#activities");

	group = activities.selectAll(".activity").data(activityList);

	var enter = group.enter().append("div");

	enter.attr("id", function(d) { return d.title })
		.attr("class", "activity")
		.style("background-color", function(d) { return tEngine.getColor(d.color) } );
		
	enter.insert("div")
		.attr("class", "checkbox")
		.append("input")
			.attr("type", "checkbox")
			.property("checked", function(d) { return d.visible })
			.on("change", function(d) { d.switchVisible(); });

	enter.insert("div").attr("class", "title")
		.text(function(d) { return d.title })


	group.each(
		function(d,i)
		{
			var data = d;
			var div = d3.select(this);
			
			d3.select(this)
				.attr("id", function(d) { return d.title })
				.attr("class", "activity")
				.style("background-color", function(d) { return tEngine.getColor(d.color) } );

			d3.select(this).selectAll("div.title")
				.text(function(d) { return data.title })
				.on("click", function() { data.switchInfo(div) });

			d3.select(this).selectAll("div.checkbox input")
				.property("checked", function() { return data.visible; })
				.on("change", function() { data.switchVisible(); });
		}
	);
	



	group.exit().remove();
}

TemporalEngine.prototype.removeActivity = function(activity)
{
	delete this.activityMap[activity.title];
}

TemporalEngine.prototype.hexToRgb = function(hex) 
{
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

TemporalEngine.prototype.nextAnnotationIdentifier = function()
{
	return "Annotation"+this.lastAnnotationID++;
}

TemporalEngine.prototype.loadedSource = function()
{
	this.sourcesLoaded++;
}

TemporalEngine.prototype.panLocked = function(pan, source)
{
	for(var x in this.graphList)
	{
		var graph = this.graphList[x].graph;
		if(graph.timelineLocked == true && graph.dataSource.source == source)
		{
			graph.timeInterval.pan(pan);
			graph.refreshTimeInterval();
		}
	}
	this.timeline.render();
}

TemporalEngine.prototype.pinchLocked = function(distance, source)
{
	for(var x in this.graphList)
	{
		var graph = this.graphList[x].graph;
		if(graph.timelineLocked == true && graph.dataSource.source == source)
		{
			graph.timeInterval.pinch(distance);	
		}
	}
}


TemporalEngine.prototype.setTimeline = function(element)
{
	this.timeline = new Timeline(element[0]);
	this.interactiveObjectList["timeline"] =  this.timeline;
}

TemporalEngine.prototype.repositionGraphsToFitGraph = function(movedGraph)
{
		this.updateGraphsPositionExcept(movedGraph);
		for(var x in this.graphList)
		{
			var obj = this.graphList[x];
			var graph = this.graphList[x].graph;

			if(movedGraph != graph)
			{
				if(this.cursorPosition[0] >= graph.position[0] && this.cursorPosition[0] <= graph.position[0]+graph.size[0])
				{
					if(graph.position[1]+graph.size[1]/2 < this.cursorPosition[1] && obj.movedUp == false) 
					{
						obj.movedDown = false;
						obj.movedUp = true;
							var sel = d3.select(graph.element);
							var top = this.graphYForIndex(this.graphIndex(graph));
							sel.transition().duration(this.animationDuration).style("top", top+"px");
							graph.position[1] = top;
					}
					else if(graph.position[1]+graph.size[1]/2 >= this.cursorPosition[1] && obj.movedDown == false)
					{
						obj.movedDown = true;
						obj.movedUp = false;

						var sel = d3.select(graph.element);
						var top = this.graphYForIndex(this.graphIndex(graph));
						sel.transition().duration(this.animationDuration).style("top", top+50+"px");
						graph.position[1] = top+50;
					}
				}
				else if(obj.movedDown != false || obj.movedUp != false)
				{
					obj.movedDown = false;
					obj.movedUp = false;

					var sel = d3.select(graph.element);
					var top = this.graphYForIndex(this.graphIndex(graph));
					sel.transition().duration(this.animationDuration).style("top", top+"px");
					graph.position[1] = top;
				}
			}
		}
}

TemporalEngine.prototype.createAnnotation = function(giSource)
{
	console.log("tEngine annotation");
	var annotation = new Annotation(giSource);
}

TemporalEngine.prototype.initPackery = function()
{

	var $container = $('#channelsWindow .container');

	$container.packery({
		itemSelector: '.channel',
		// gutter: 10,
		columnWidth: 50,
		rowHeight: 30
	});

	this.pckry = $container.data('packery');

	var itemElems = this.pckry.getItemElements();

	for ( var i=0, len = itemElems.length; i < len; i++ ) {
		var elem = itemElems[i];
		// make element draggable with Draggabilly
		var draggie = new Draggabilly(elem);
		draggie.temporalElem = elem;
		// bind Draggabilly events to Packery
		this.pckry.bindDraggabillyEvents( draggie );
		draggie.on( 'dragMove', function(draggieInstance, event, pointer) { tEngine.dragChannel.call(tEngine, draggieInstance, event, pointer) } );
		draggie.on( 'dragEnd', function(draggieInstance, event, pointer) { tEngine.dropChannel.call(tEngine, draggieInstance, event, pointer) } );
	}

}

TemporalEngine.prototype.dropChannel = function(draggieInstance, event, pointer, channel)
{
	var begin = undefined;
	var end = undefined;
	
	for(x in this.graphList)
	{
		if(this.graphList[x].graph.timelineLocked == true)
		{
			begin = this.graphList[x].graph.timeInterval.begin;
			end = this.graphList[x].graph.timeInterval.end;
			break;
		}
	}

	var elem = draggieInstance.temporalElem;
	var x;
	for(x in this.channelMap)
	{
		if(this.channelMap[x].element == elem)
		{
			break;
		}
	}

	var graph;

	var box  = this.graphListElement.getBoundingClientRect();

	if(pointer.clientX > 300 && pointer.clientX < 1000)
	{
		var graph = this.bindGraphAtIndex(this.graphIndexForY(pointer.clientY), this.channelMap[x], pointer.pageY, begin, end);
		for(var x in this.activityMap)
		{
			this.activityMap[x].addInstancesToGraph(graph);
		}
	}
}

TemporalEngine.prototype.graphIndexForY = function(y)
{
	var n = 0;
	for(var x in this.graphList)
	{
		if(y < this.graphList[x].graph.position[1]+50)
		{
			break;
		}
		n++;
	}
	return n;
}

TemporalEngine.prototype.searchForChannel = function()
{

}


TemporalEngine.prototype.dragChannel = function(draggieInstance, event, pointer)
{
	// var animation = new Animation(this.element.style);
	// animation.animatedProperty = "top";
	// animation.animateTo = newPosY;
	// animation.duration = 400;
	// animation.unit = "px";
	// animation.elementOwner = this;
	// animation.start();

	var cursorPos = [pointer.pageX, pointer.pageY];

	for(var x in this.graphList)
	{
		var obj = this.graphList[x];
		var graph = this.graphList[x].graph;
		if(cursorPos[0] >= graph.position[0] && cursorPos[0] <= graph.position[0]+graph.size[0])
		{
			if(graph.position[1]+graph.size[1]/2 < cursorPos[1] && obj.movedUp == false) 
			{
				obj.movedDown = false;
				obj.movedUp = true;
					var sel = d3.select(graph.element);
					var top = this.graphYForIndex(this.graphIndex(graph));
					sel.transition().duration(this.animationDuration).style("top", top+"px");
					graph.position[1] = top;
			}
			else if(graph.position[1]+graph.size[1]/2 >= cursorPos[1] && obj.movedDown == false)
			{
				obj.movedDown = true;
				obj.movedUp = false;

				var sel = d3.select(graph.element);
				var top = this.graphYForIndex(this.graphIndex(graph));
				sel.transition().duration(this.animationDuration).style("top", top+50+"px");
				graph.position[1] = top+50;
			}
		}
		else if(obj.movedDown != false || obj.movedUp != false)
		{
			obj.movedDown = false;
			obj.movedUp = false;

			var sel = d3.select(graph.element);
			var top = this.graphYForIndex(this.graphIndex(graph));
			sel.transition().duration(this.animationDuration).style("top", top+"px");
			graph.position[1] = top;
		}
	}	
}

TemporalEngine.prototype.test = function(arg)
{
	console.log(arg);
}

TemporalEngine.prototype.graphYForIndex = function(index)
{

	var pos = 110+(+(index))*140+10;
	return pos;
}


TemporalEngine.prototype.graphIndex = function(graph)
{
	return this.graphList[graph.element.id].index;
}


TemporalEngine.prototype.pressKey = function(event)
{
	// tEngine.clearDebug();
	// tEngine.debug(event.keyCode+" press");
	this.keyMap[event.keyCode] = true;
}

TemporalEngine.prototype.releaseKey = function(event)
{
	// tEngine.clearDebug();
	// tEngine.debug(event.keyCode+" release");
	this.keyMap[event.keyCode] = false;
}


TemporalEngine.prototype.initColors = function ()
{
	// this.colorArray.push("#054948");
	// this.colorArray.push("#217273");
	// this.colorArray.push("#c26400");
	// this.colorArray.push("#c18000");
	// this.colorArray.push("#461654");
	// this.colorArray.push("#7a4f85");
	// this.colorArray.push("#97809d");
	// this.colorArray.push("#3c740f");
	// this.colorArray.push("#5b9f26");
	// this.colorArray.push("#b7347a");

	this.colorArray.push("#054948");
	this.colorArray.push("#217273");
	this.colorArray.push("#068e8c");
	this.colorArray.push("#5fa1a0");
	this.colorArray.push("#461654");
	this.colorArray.push("#7a4f85");
	this.colorArray.push("#97809d");
	this.colorArray.push("#0e4b68");
	this.colorArray.push("#2a5a70");
	this.colorArray.push("#4e7d91");
}

TemporalEngine.prototype.refreshGraphsWithChannel = function(channel)
{
	for(x in this.graphList)
	{
		if(this.graphList[x].graph.channel == channel)
		{
			this.graphList[x].graph.refreshTimeInterval();
		}
	}
}

TemporalEngine.prototype.addChannel = function(name, dataSource)
{
	var channelDiv = d3.select("#channelsWindow .container").append("div");

	var channel = new Channel(name, dataSource, channelDiv[0][0]);
	channelDiv
			.attr("class", "channel")
			.style("background-color", this.getColor(channel.color))
			.property("innerHTML", name);

	this.channelMap[name] = channel;
	return channel;
}

TemporalEngine.prototype.getColor = function(index)
{	
	return this.colorArray[index%this.colorArray.length];
}

TemporalEngine.prototype.pickColor = function()
{
	return this.lastColor++;
}

TemporalEngine.prototype.switchDebug = function()
{
	this.debugFlag = !this.debugFlag;
	this.clearDebug();
	this.clearDebug("graphs");
}

TemporalEngine.prototype.isNumber = function(n)
{
	return !isNaN(parseFloat(n)) && isFinite(n);
}

TemporalEngine.prototype.testCollision = function(mouseCoords, interactiveObject)
{
	var aux = [];
	aux.position = interactiveObject.position;
	aux.size     = interactiveObject.getSize();

	if(mouseCoords[0] >= aux.position[0] && mouseCoords[1] >= aux.position[1])
	{
		if(mouseCoords[0] <= aux.position[0] + aux.size[0] && mouseCoords[1] <= aux.position[1] + aux.size[1])
		{
			return true;
		}
		return false;
	}
	return false;
}

TemporalEngine.prototype.debug = function(message, target)
{
	if(typeof target === 'undefined')
	{
		target = "debug";
	}

	var dbg = document.getElementById(target);
	dbg.innerHTML = message + "<br>" + dbg.innerHTML;
}

TemporalEngine.prototype.clearDebug = function(target)
{
	if(typeof target === 'undefined')
	{
		target = "debug";
	}
	var dbg = document.getElementById(target);
	dbg.innerHTML = "";
}

// function updatePosition()
// {
// 	for(x in interactiveObjectList)
// 	{
// 		interactiveObjectList[x].updateLastPosition();
// 	}
// }
TemporalEngine.prototype.updateDebug = function()
{
	if(this.debugFlag == true)
	{
		this.clearDebug();
		for(var x in this.touchList)
		{
			this.debug("touchList["+x+"] -> p ("+this.touchList[x].position[0]+", "+this.touchList[x].position[1]+") <br>&nbsp;&nbsp;lp("+this.touchList[x].lastPosition[0]+", "+this.touchList[x].lastPosition[1]+")- "+this.touchList[x].over.length+ " - "+this.touchList[x].timeSinceStarted());
		}
	}
}

TemporalEngine.prototype.updateGraphs = function()
{
	if(this.debugFlag == true)
	{
		this.clearDebug("graphs");
		for(var x in this.interactiveObjectList)
		{
			this.debug("il["+x+"] -> lp ("+this.interactiveObjectList[x].lastPosition[0]+", "+this.interactiveObjectList[x].lastPosition[1]+")<br>&nbsp;&nbsp;pos ("+this.interactiveObjectList[x].position[0]+", "+this.interactiveObjectList[x].position[1]+")<br>&nbsp;&nbsp;s->("+this.interactiveObjectList[x].size[0]+", "+this.interactiveObjectList[x].size[1]+") - "+this.interactiveObjectList[x].touchCount+" - drag: "+this.interactiveObjectList[x].dragging, "graphs");
		}
	}
}

TemporalEngine.prototype.touchEnd = function(event)
{
	// console.log("mainEnd");
	// event.preventDefault();
	for(var x in event.changedTouches)
	{
		var touch = event.changedTouches[x];
		var index = touch.identifier;
		if(typeof index !== 'undefined')
		{
			this.touchList[index].end();
			delete this.touchList[index];
		}
	}
}

TemporalEngine.prototype.parseTouches = function(touches)
{
	// var i = 0;
	for(var x in touches)
	{
		var touch = touches[x];
		var index = touch.identifier;

		if(typeof index !== 'undefined')
		{
			if(typeof this.touchList[index] === 'undefined') // if touch beginning
			{
				this.touchList[index] = new Touch(touch);
				this.touchList[index].updatePosition([touch.pageX, touch.pageY]);
			}
			else
			{
				this.touchList[index].touch = touch;
				this.touchList[index].updatePosition([touch.pageX, touch.pageY]);
			}
		}
		// var j = 0;
		// for(y in graphList)
		// {
		// 	if(i == j)
		// 	{
		// 		graphList[y].elem.style.position = "absolute";
		// 		graphList[y].elem.style.top = touchList[index].posY+"px";
		// 		graphList[y].elem.style.left = touchList[index].posX+"px";
		// 	}
		// 	j++;
		// }
		// i++;
	}
}

// TemporalEngine.prototype.calculateDeltas = function(touch)
// {
// 	var deltaX = touch.startPosition[0] - touch.position[0];
// 	var deltaY = touch.startPosition[1] - touch.position[1];
// 	return [deltaX, deltaY];
// }

// TemporalEngine.prototype.deltaThreshold = function(delta, value)
// {
// 	return delta[0]*delta[0]+delta[1]*delta[1] < value*value;
// }

TemporalEngine.prototype.updateTouches = function()
{
	var handled = [];
	for(var x in this.touchList)
	{
		for(var y in this.touchList[x].over)
		{
			// touchList[x].over[y].removeTouchTarget(touchList[x]);
			this.touchList[x].over[y].decreaseTouchCount();
		}

		this.touchList[x].over	= [];

		for(var y in this.interactiveObjectList)
		{
			var mousePos = [];

			var result = this.testCollision(this.touchList[x].position, this.interactiveObjectList[y]);
			if(result != false)
			{
				// graphList[y].addTouchTarget(touchList[x]);
				this.interactiveObjectList[y].increaseTouchCount();
				this.touchList[x].over.push(this.interactiveObjectList[y]);
			}
		}
		this.touchList[x].handle();
	}
	// var tgt = findDivParent(event.gesture.target);
	// if(tgt != -1)
	// {
	// 	graphList[tgt.id].dragged = true;
	// 	touchList[index].targetElement = tgt;
	// 	touchList[index].handled = true;
	// 	tgt.style.position = "absolute";
	// 	tgt.style.zIndex = 1;
	// }
}

TemporalEngine.prototype.update = function()
{
	if(typeof this.pckry === "undefined" && this.sourcesLoaded >= this.totalSources && this.sourcesLoaded > 0)
	{
		tEngine.initPackery();
	}

	for(var x in this.interactiveObjectList)
	{
		this.interactiveObjectList[x].update();
		// if(x == 'bar')
		// {
		// 	console.log(this.interactiveObjectList[x]);
		// }
	}
	this.updateDebug();
	this.updateGraphs();
}

TemporalEngine.prototype.wheel = function (event)
{
	// event.preventDefault();
	for(var x in this.interactiveObjectList)
	{
		var result = this.testCollision(this.cursorPosition, this.interactiveObjectList[x]);
		if(result == true)
		{
			event.preventDefault();
			if(this.interactiveObjectList[x].iType == "Graph" || this.interactiveObjectList[x].iType == "Timeline")
			{
				var fakeTouch = [];
				fakeTouch.over = [];
				fakeTouch.over.length = 0;

				if(this.interactiveObjectList[x].pinchable == true)
				{
					this.interactiveObjectList[x].pinch(undefined, event.wheelDeltaY/10, 0, true);
				}
				if(this.interactiveObjectList[x].pannable == true)
				{
					this.interactiveObjectList[x].pan(fakeTouch, event.wheelDeltaX/100);
				}
			}
		}
	}
}


TemporalEngine.prototype.processEvents = function()
{
	// for(var y in this.interactiveObjectList)
	// {
	// 	var result = this.testCollision(this.cursorPosition, this.interactiveObjectList[y]);
	// 	if(result != false)
	// 	{
	// 		this.interactiveObjectList[y].mouseOver(this.interactiveObjectList[y]);
	// 	}
	// }

	for(var x in this.touchList)
	{
		this.touchList[x].fireHold();
		this.touchList[x].fireSwipe();
		this.touchList[x].firePinch();
		this.touchList[x].firePan();
	}
	this.update();
	window.setTimeout(function() 
	{
		tEngine.processEvents()
	}
	, 1000/this.framerate);
}

TemporalEngine.prototype.touchMove = function(event)
{
	// event.preventDefault();
	// console.log(event.touches);

	this.parseTouches(event.touches);
	this.updateTouches();

	this.updateDebug();
	this.updateGraphs();
}

TemporalEngine.prototype.addGraphToTimeline = function(graph)
{
	this.timeline.addGraph(graph);
	this.timeline.render();
}

TemporalEngine.prototype.bindGraphAtIndex = function(index, channel, y, begin, end)
{
    var graph = new Graph(this.graphListElement, channel);
    if(typeof begin !== "undefined") 
    {
    	graph.timeInterval.begin = begin;
    	graph.timeInterval.end   = end;
    }
    
    this.interactiveObjectList[graph.element.id] = graph;

    this.graphList[graph.element.id] = [];
    this.graphList[graph.element.id].graph = graph;
    this.graphList[graph.element.id].movedUp = false;
    this.graphList[graph.element.id].movedDown = false;
    this.graphList[graph.element.id].index = index;

    var graphDiv = d3.select(graph.element);

    graphDiv.style("position", "absolute")
		.style("top", y+"px");

	
	graph.somethingChanged();
	this.updateGraphsPosition();
	graph.timeInterval.buildDataInterval();
	graph.refreshTimeInterval();
    this.addGraphToTimeline(graph);

    return graph;
}

TemporalEngine.prototype.bindGraph = function(channel)
{

    var graph = new Graph(this.graphListElement, channel);
    this.addGraphToTimeline(graph);
    this.interactiveObjectList[graph.element.id] = graph;

    this.graphList[graph.element.id] = [];
    this.graphList[graph.element.id].graph = graph;
    this.graphList[graph.element.id].movedUp = false;
    this.graphList[graph.element.id].movedDown = false;
    this.graphList[graph.element.id].index = this.graphListSize()-1;

    var graphDiv = d3.select(graph.element);

    graphDiv.style("position", "absolute")
		.style("top", tEngine.graphYForIndex(this.graphList[graph.element.id].index)+"px");

	graph.somethingChanged();

	this.updateGraphsPosition();

}

TemporalEngine.prototype.graphListSize = function()
{
	var n = 0;
	for(var x in this.graphList) n++;
	return n;
}

TemporalEngine.prototype.updateGraphsPosition = function()
{
	var list = [];
	for(var x in this.graphList)
	{
		this.graphList[x].graph.somethingChanged();
		list.push([this.graphList[x].graph.position[1],this.graphList[x].graph]);
	}

	list.sort(this.graphSortFunction);
	
	for(var x in this.graphList)
	{
		for(var i=0;i<list.length;i++)
		{
			if(this.graphList[x].graph == list[i][1])
			{
				var graphd3 = d3.select(this.graphList[x].graph.element);
				var graph = this.graphList[x].graph;
				this.graphList[x].index = i;
				graphd3.transition().duration(this.animationDuration).style("top", tEngine.graphYForIndex(i)+"px");
				graph.position[1] = tEngine.graphYForIndex(i);
			}
		}
	}
}

TemporalEngine.prototype.updateGraphsPositionExcept = function(graph)
{
	var list = [];
	for(var x in this.graphList)
	{
		if(graph != this.graphList[x].graph)
		{
			this.graphList[x].graph.somethingChanged();
			list.push([this.graphList[x].graph.position[1],this.graphList[x].graph]);
		}
	}

	list.sort(this.graphSortFunction);
	
	for(var x in this.graphList)
	{
		for(var i=0;i<list.length;i++)
		{
			if(this.graphList[x].graph == list[i][1])
			{
				var graphd3 = d3.select(this.graphList[x].graph.element);
				var graph = this.graphList[x].graph;
				this.graphList[x].index = i;
				// graphd3.transition().duration(1000).style("top", tEngine.graphYForIndex(i)+"px");
				// graph.position[1] = tEngine.graphYForIndex(i);
			}
		}
	}
}

TemporalEngine.prototype.graphSortFunction = function(a, b)
{
	if(a[0] < b[0])
		return -1;
	else if(a[0] == b[0])
		return 0;
	else
		return 1;
}

TemporalEngine.prototype.bindButton = function(element)
{
	if(typeof this.interactiveObjectList[element.id] === 'undefined')
    {
    	this.interactiveObjectList[element.id] = [];
    }

    var button = new Button(element);
    this.interactiveObjectList[element.id] = button;
}


TemporalEngine.prototype.enableDrag = function(event)
{
	this.dragEnabled = true;
	this.touchMove(this.mouseWrapper(event));
}

TemporalEngine.prototype.disableDrag = function(event)
{
	if(this.dragEnabled == true)
	{
		this.touchEnd(this.mouseWrapper(event));
	}
	this.dragEnabled = false;
}

TemporalEngine.prototype.mouseMove = function(event)
{
	this.cursorPosition[0] = event.clientX;
	this.cursorPosition[1] = event.clientY;
	
	if(this.dragEnabled == true)
	{
		this.touchMove(this.mouseWrapper(event));
	}
}

TemporalEngine.prototype.mouseWrapper = function(event)
{
	var touch = [];
	touch.identifier = 0;
	touch.pageX = event.pageX;
	touch.pageY = event.pageY;
	event.touches = [];
	event.changedTouches = [];
	event.changedTouches.push(touch);
	event.touches.push(touch);

	return event;
}

TemporalEngine.prototype.touchCancel = function(event)
{
	console.log("cancel");
}

TemporalEngine.prototype.clone = function(obj)
{
	var ret = {};
	for(var i in obj)
	{
		// console.log(typeof obj[i], i);
		if(typeof obj[i] == 'object' && i != 'element' && i != 'parent' && typeof obj[i] == 'undefined')
			ret[i] = obj[i].slice(0);
		else
			ret[i] = obj[i];
	}
	return ret;
}

TemporalEngine.prototype.removeFromInteractiveObjectList = function (identifier)
{
	for(var x in this.interactiveObjectList)
	{
		if(this.interactiveObjectList[x].element.id == identifier)
		{
			delete this.interactiveObjectList[x];
		}
	}
}

TemporalEngine.prototype.countTouchesObjectIsTarget = function (object)
{
	var count = 0;
	for(var x in this.touchList)
	{
		if(this.touchList[x].target == object)
			count++;
	}
	return count;
}

var tEngine = new TemporalEngine();
