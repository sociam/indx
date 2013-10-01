function Annotation(indexBegin, indexEnd, activity, sourceGraph, id)
{
	GraphInterval.call(this, sourceGraph);
	this.z = 101;
	this.identifier = tEngine.nextAnnotationIdentifier();
	this.dataSource = sourceGraph.dataSource;
	this.timeInterval = new TimeInterval();
	this.timeInterval.indexBegin = indexBegin;
	this.timeInterval.indexEnd = indexEnd;
	this.timeInterval.dataSource = sourceGraph.dataSource;
	this.timeInterval.loadIntervals(); // load begin and end from indexes
	this.timeInterval.buildDataInterval();

	this.sourceGraph = sourceGraph;

	this.activity = activity;
	this.annotationID = id;
	
	this.inputField = undefined;
	this.label = undefined;
	this.selection = undefined;
	this.removeButton = undefined;

	this.selected = true;
	this.overInput = false;

	this.color = undefined;

	this.init();

	if(typeof activity === "undefined")
	{
		this.labeled = false;
	}
	else
		this.labeled = true;

	InteractiveObject.call(this, this.selection[0][0]);
	tEngine.interactiveObjectList[this.identifier] = this;
	this.updateLastPosition();
}

Annotation.prototype = tEngine.clone(GraphInterval.prototype);
Annotation.prototype.parent = GraphInterval.prototype;

Annotation.prototype.select = function()
{
	this.selected = true;
	this.selection.style("z-index", tEngine.lastZIndex++);
	this.selection.style("opacity", 1);
	this.removeButton.style("visibility", "inherit");
}

Annotation.prototype.unselect = function()
{
	this.selected = false;
	this.selection.style("opacity", 0.7);
	this.removeButton.style("visibility", "hidden");
}

Annotation.prototype.inputKeydown = function()
{
	var event = d3.event;
	if(event.keyCode == 13) // enter
	{
		this.inputField[0][0].blur();
	}
}


Annotation.prototype.inputFocus = function()
{
	this.inputField.attr("class", "selectable hiddenField annotationLabel");
}

Annotation.prototype.inputBlur = function()
{
	this.inputField.attr("class", "selectable hiddenField annotationLabel");
	var input = this.inputField.property("value");
	if(this.inputField.property("value") != "Name")
	{
		if(typeof this.activity !== "undefined") // was labeled
		{
			if(this.label != this.inputField.property("value"))
			{
				this.activity.removeInstance(this.annotationID, this.sourceGraph);

				if(typeof tEngine.activityMap[input] === "undefined") // if activity doesn't exist
				{
					this.activity = new Activity(input);
					tEngine.activityMap[input] = this.activity;
					tEngine.updateActivityList();	
				}
				else
				{
					this.activity = tEngine.activityMap[input];
				}
				this.label = input;
				this.annotationID = this.activity.addInstance(this.timeInterval.begin, this.timeInterval.end, this.sourceGraph);
				this.sourceGraph.annotations[this.annotationID] = this;
				this.color = this.activity.color;
				var colorRGB = tEngine.hexToRgb(tEngine.getColor(this.color));
				this.selection.style("background", "rgba("+colorRGB.r+", "+colorRGB.g+", "+colorRGB.b+", 0.5)");
			}
		}
		else // was unlabeled
		{
			if(this.labeled == false)
			{
				this.labeled = true;
				this.sourceGraph.removeUnlabeled(this);
			}
			if(typeof tEngine.activityMap[input] === "undefined") // if activity doesn't exist
			{
				this.activity = new Activity(input);
				tEngine.activityMap[input] = this.activity;
				tEngine.updateActivityList();	
			}
			else
			{
				this.activity = tEngine.activityMap[input];
			}
			this.label = input;
			this.annotationID = this.activity.addInstance(this.timeInterval.begin, this.timeInterval.end, this.sourceGraph);
			this.sourceGraph.annotations[this.annotationID] = this;
			this.color = this.activity.color;
			var colorRGB = tEngine.hexToRgb(tEngine.getColor(this.color));
			this.selection.style("background", "rgba("+colorRGB.r+", "+colorRGB.g+", "+colorRGB.b+", 0.5)");
		}
	}
	else
	{
		if(typeof this.activity !== "undefined") // if had an activity
		{
			this.activity.removeInstance(this.annotationID, this.sourceGraph);
			console.log(this.activity);
		}
		this.labeled = false;
		this.activity = undefined;
		this.annotationID = undefined;
		this.sourceGraph.addUnlabeled(this);
		this.selection.style("background", "rgba(100, 100, 100, 0.5)");
	}
	this.label = this.inputField.property("value");
}

Annotation.prototype.inputFieldMouseEvent = function()
{
	var event = d3.event;
	if(event.type == "mousedown")
	{
		this.overInput = true;
		this.sourceGraph.pannable = false;
	}
	else if(event.type == "mouseover" && this.overInput == true)
	{
		this.sourceGraph.pannable = false;
	}
	else if(event.type == "mouseout")
	{
		this.overInput = false;
		this.sourceGraph.pannable = true;
	}

}

Annotation.prototype.update = function()
{
}

Annotation.prototype.refresh = function()
{
	this.interval.begin = this.sourceGraph.xForIndex(this.timeInterval.getIndexBegin());
	this.interval.end = this.sourceGraph.xForIndex(this.timeInterval.getIndexEnd());

	var graphDiv = d3.select("#"+this.sourceGraph.element.id);

	var pickerBegin = graphDiv.select("#pickerBegin");
	var pickerEnd = graphDiv.select("#pickerEnd"); 

	pickerBegin.style("left", this.interval.begin+1+"px");
	pickerEnd.style("left", this.interval.end+1+"px");

	// console.log(this.selection.style("visibility"))
	// if()
	// {

	// }

	if(this.interval.begin > this.interval.end)
	{
		this.setWidth(this.interval.end-this.interval.begin);
		this.selection.style("left", this.interval.end+1+"px")
				.style("visibility", "visible")
				.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");
		this.inputField.style("left", parseInt(this.selection.style("width"))/2+"px");
	}
	else
	{
		this.setWidth(this.interval.end-this.interval.begin);
		this.selection.style("left", this.interval.begin+1+"px")
				.style("visibility", "visible")
				.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");
		this.inputField.style("left", parseInt(this.selection.style("width"))/2-50+"px");
	}
}

Annotation.prototype.closeSelection = function()
{
	// this.sourceGraph.removeAnnotationPointer(this.annotationID);

	if(typeof this.activity !== "undefined")
		this.activity.removeInstance(this.annotationID, this.sourceGraph);

	delete tEngine.interactiveObjectList[this.identifier];
	
	var graphDiv = d3.select("#"+this.sourceGraph.element.id);

	if(this.removeButton != undefined)
		this.removeButton.remove();
	if(this.selection != undefined)
		this.selection.remove();
	if(this.inputField != undefined)
		this.inputField.remove();
}

Annotation.prototype.destroy = function()
{
	delete tEngine.interactiveObjectList[this.identifier];
	
	var graphDiv = d3.select("#"+this.sourceGraph.element.id);

	if(this.removeButton != undefined)
		this.removeButton.remove();
	if(this.selection != undefined)
		this.selection.remove();
	if(this.inputField != undefined)
		this.inputField.remove();
}

Annotation.prototype.highlight = function()
{
	$(this.inputField[0][0]).focus();
	$(this.inputField[0][0]).select();
}

Annotation.prototype.init = function()
{
		var xBegin = this.interval.begin;
		var xEnd = this.interval.end;

		var delta;
		if(xBegin>xEnd)
			delta = xBegin-xEnd;
		else
			delta = xEnd-xBegin;

		var thisAnnotation = this;

		var graphDiv = d3.select("#"+this.sourceGraph.element.id);

		this.selection = graphDiv.append("div")
						.attr("id", "selection")
						.style("left", xBegin+"px")
						.style("visibility", "hidden")
						.attr("class", "annotation pickerTools")
						.style("z-index", tEngine.lastZIndex++)
						// .attr("contenteditable", "true")
						.on("dblclick", function() 
						{
							$(thisAnnotation.inputField[0][0]).focus();
							$(thisAnnotation.inputField[0][0]).select();
						})
						.on("mousemove", function() 
		{
			thisAnnotation.sourceGraph.mouseMove.call(thisAnnotation.sourceGraph, d3.mouse(thisAnnotation.sourceGraph.element));
		});

		this.removeButton = this.selection.append("div")
			.attr("id", "remove")
			.attr("class", "removeButton pickerTools")
			.on("click", function(event){ thisAnnotation.closeSelection.call(thisAnnotation, event) });

		this.inputField = this.selection.append("input")
			.attr("type", "text")
			.property("value", "Name")
			.attr("class", "selectable hiddenField annotationLabel")
			.style("top", (this.sourceGraph.getHeight()-this.sourceGraph.footerHeight)/2-20+"px")
			.style("left", this.getWidth()/2+"px")
			.on("mousedown",  function() { thisAnnotation.inputFieldMouseEvent.call(thisAnnotation)})
			.on("mouseover",  function() { thisAnnotation.inputFieldMouseEvent.call(thisAnnotation)})
			.on("mouseout",  function() { thisAnnotation.inputFieldMouseEvent.call(thisAnnotation)})
			.on("focus",  function() { thisAnnotation.inputFocus.call(thisAnnotation)})
			.on("blur",  function() { thisAnnotation.inputBlur.call(thisAnnotation)})
			.on("keydown",  function() { thisAnnotation.inputKeydown.call(thisAnnotation)});

		if(typeof this.activity !== "undefined")
		{
			this.inputField.property("value", this.activity.title);
			this.label = this.activity.title;
			this.color = this.activity.color;
			var colorRGB = tEngine.hexToRgb(tEngine.getColor(this.color));
			this.selection.style("background", "rgba("+colorRGB.r+", "+colorRGB.g+", "+colorRGB.b+", 0.5)");

		}

		// this.scaleBar = graphDiv.append("div")
		// 		.attr("id", "scaleBar")
		// 		.style("left", xBegin+"px")
		// 		.attr("class", "scaleBar pickerTools");

		// 	this.scaleBar = new ScaleBar(this.scaleBar, this, this.sourceGraph.element.id+"selectionScaleBar");
		// 	tEngine.interactiveObjectList[this.sourceGraph.element.id+"selectionScaleBar"] = this.scaleBar;

		
}

Annotation.prototype.touchStarted = function(touch)
{
	if(this.labeled == true)
		tEngine.selectAnnotation(this.annotationID);
	else
		this.select();
}

Annotation.prototype.touchEnded = function(touch)
{
	this.updateLastPosition();
}


Annotation.prototype.pan = function(touch)
{
	touch.setTarget(this.sourceGraph);
	if(this.sourceGraph.pannable == true)
		this.sourceGraph.pan(touch);
}

Annotation.prototype.hold = function(touch)
{
	// console.log("hold");
}