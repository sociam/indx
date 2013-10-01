function GraphInterval(sourceGraph, cloneOf)
{
	this.identifier = sourceGraph.element.id+"Selection";
	this.z = 101;
	this.interval = [];
	this.interval.indexBegin = undefined;
	this.interval.indexEnd = undefined;
	this.interval.pxBegin = undefined;
	this.interval.pxEnd = undefined;
	this.size = [];
	this.indexDelta = 0;
	this.sourceGraph = sourceGraph;
	this.dataSource = sourceGraph.dataSource;
	this.inputField = undefined;
	this.label = undefined;
	this.removeButton = undefined;
	this.acceptButton = undefined;
	this.selection = undefined;
	this.scaleBar = undefined;
	this.createdTools = false;
	this.ioType = "GraphInterval";

	if(typeof cloneOf !== "undefined")
		this.cloneOf = cloneOf;
	else
		this.cloneOf = -1;

	this.deltaTime = 0;

	this.fixed = false;

	this.dataInterval = [];

	this.draggingScale = false;
	this.scaleInitialPos = undefined;

}

GraphInterval.prototype = tEngine.clone(InteractiveObject.prototype);
GraphInterval.prototype.parent = InteractiveObject.prototype;

GraphInterval.prototype.constructor = InteractiveObject;

GraphInterval.prototype.validateOrder = function()
{	
	if(this.interval.pxBegin > this.interval.pxEnd)
	{
		var aux;
		aux = this.interval.pxBegin;
		this.interval.pxBegin = this.interval.pxEnd;
		this.interval.pxEnd = aux;

		aux = this.interval.indexBegin;
		this.interval.indexBegin = this.interval.indexEnd;
		this.interval.indexEnd = aux;
	}
	this.indexDelta = this.interval.indexEnd - this.interval.indexBegin;
}



GraphInterval.prototype.closeSelection = function()
{
	this.sourceGraph.selectingInterval = false;
	this.sourceGraph.annotating = false;
	this.sourceGraph.renderData();

	delete tEngine.interactiveObjectList[this.identifier];
	
	var graphDiv = d3.select("#"+this.sourceGraph.element.id);

	if(this.removeButton != undefined)
		this.removeButton.remove();
	if(this.acceptButton != undefined)
		this.acceptButton.remove();
	if(this.selection != undefined)
		this.selection.remove();
	if(this.scaleBar != undefined)
		this.scaleBar.destroy();
	if(this.infoField != undefined)
		this.infoField.remove();

	this.sourceGraph.createdInterval = false;
	this.sourceGraph.selectedInterval = new GraphInterval(this.sourceGraph);
	this.sourceGraph.pannable = true;
	this.sourceGraph.pinchable = true;
}

GraphInterval.prototype.cancelAnnotate = function()
{
	if(this.sourceGraph.annotating == true)
	{
		this.sourceGraph.annotating = false;
		this.closeSelection();
	}
}

GraphInterval.prototype.annotate = function()
{
	var annotation = new Annotation(this.interval.indexBegin, this.interval.indexEnd, undefined, this.sourceGraph);
	this.sourceGraph.unlabeledAnnotations.push(annotation);
	this.closeSelection();	
}

GraphInterval.prototype.update = function()
{
	if(this.sourceGraph.selectingInterval == true && this.sourceGraph.createdInterval == true) // called when user is selecting interval
	{
		this.interval.pxBegin = this.sourceGraph.xForIndex(this.interval.indexBegin);
		this.interval.pxEnd = this.sourceGraph.xForIndex(this.interval.indexEnd);
	}
	else if(this.sourceGraph.createdInterval == true) // called when the user finished selecting the interval
	{
		if(this.fixed == true)
		{
			this.interval.pxBegin = this.sourceGraph.xForIndex(this.interval.indexBegin);
			this.interval.pxEnd = this.sourceGraph.xForIndex(this.interval.indexEnd);
		}
		else
		{
			this.interval.indexBegin = this.sourceGraph.indexForX(this.interval.pxBegin);
			this.interval.indexEnd   = this.sourceGraph.indexForX(this.interval.pxEnd);
		}
	}
	if(this.draggable == true)
	{
		if(this.positionLink != -1)
		{
			this.updatePositionLink();
		}
	}
}

GraphInterval.prototype.updateSelection = function()
{
	if(this.sourceGraph.selectingInterval == true && this.sourceGraph.createdInterval == true) // called when user is selecting interval
	{
		this.interval.pxBegin = this.sourceGraph.xForIndex(this.interval.indexBegin);
		this.interval.pxEnd = this.sourceGraph.xForIndex(this.interval.indexEnd);

		if(this.createdTools == true)
		{
			var graphDiv = d3.select("#"+this.sourceGraph.element.id);

			if(this.interval.pxBegin > this.interval.pxEnd)
			{
				this.setWidth(this.interval.pxBegin-this.interval.pxEnd);
				this.selection.style("left", this.interval.pxEnd+1+"px")
						.style("visibility", "visible")
						// .style("width", this.interval.pxBegin-this.interval.pxEnd+"px")
						.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");

				this.scaleBar.setWidth(this.interval.pxBegin-this.interval.pxEnd);
				this.infoField.style("left", this.interval.pxBegin+1+"px");
			}
			else
			{
				this.setWidth(this.interval.pxEnd-this.interval.pxBegin);
				this.selection.style("left", this.interval.pxBegin+1+"px")
						.style("visibility", "visible")
						// .style("width", (this.interval.pxEnd-this.interval.pxBegin)+"px")
						.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");
				this.scaleBar.setWidth(this.interval.pxEnd-this.interval.pxBegin);
				this.infoField.style("left", this.interval.pxEnd+1+"px");
			}
		}
	}
	else if(this.sourceGraph.createdInterval == true) // called when the user finished selecting the interval
	{
		if(this.fixed == true)
		{
			this.interval.pxBegin = this.sourceGraph.xForIndex(this.interval.indexBegin);
			this.interval.pxEnd = this.sourceGraph.xForIndex(this.interval.indexEnd);
		}
		else
		{
			this.interval.indexBegin = this.sourceGraph.indexForX(this.interval.pxBegin);
			this.interval.indexEnd   = this.sourceGraph.indexForX(this.interval.pxEnd);
		}
		if(this.createdTools == true)
		{
			var graphDiv = d3.select("#"+this.sourceGraph.element.id);

			if(this.interval.pxBegin > this.interval.pxEnd)
			{
				this.setWidth(this.interval.pxBegin-this.interval.pxEnd);
				this.selection.style("left", this.interval.pxBegin+1+"px")
						.style("width", (this.interval.pxBegin-this.interval.pxEnd)+"px")
						.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");
				this.scaleBar.setWidth(this.interval.pxBegin-this.interval.pxEnd);
				this.infoField.style("left", this.interval.pxEnd+1+"px");
			}
			else
			{
				this.setWidth(this.interval.pxEnd-this.interval.pxBegin);
				this.selection.style("left", this.interval.pxBegin+1+"px")
						.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px");
				this.scaleBar.setWidth(this.interval.pxEnd-this.interval.pxBegin);
				this.infoField.style("left", this.interval.pxEnd+1+"px");

			}
		}
	}
	this.updateInfo();
}

GraphInterval.prototype.updateInfo = function(dataInterval)
{
	if(this.createdTools == true && this.cloneOf == -1)
	{
		var sumValue = 0;
		var maxValue = -999999999;
		var avgValue = 0;

		var n = 0;

		if(typeof dataInterval !== "undefined")
		{
			if(this.interval.indexBegin > this.interval.indexEnd)
			{
				for(var i=0;i<this.dataInterval.length;i++)
				{
					sumValue += Number(this.dataInterval[i].data);
					if(this.dataInterval[i].data > maxValue)
						maxValue = Number(this.dataInterval[i].data);
					n++;
				}
			}
			else
			{
				for(var i=0;i<this.dataInterval.length;i++)
				{
					sumValue += Number(this.dataInterval[i].data);
					if(this.dataInterval[i].data > maxValue)
						maxValue = Number(this.dataInterval[i].data);
					n++;
				}
			}
		}
		else
		{
			if(this.interval.indexBegin > this.interval.indexEnd)
			{
				for(var i=this.interval.indexEnd;i<this.interval.indexBegin+1;i++)
				{
					sumValue += Number(this.sourceGraph.readings[i].data);
					if(this.sourceGraph.readings[i].data > maxValue)
						maxValue = Number(this.sourceGraph.readings[i].data);
					n++;
				}
			}
			else
			{
				for(var i=this.interval.indexBegin;i<this.interval.indexEnd+1;i++)
				{
					sumValue += Number(this.sourceGraph.readings[i].data);
					if(this.sourceGraph.readings[i].data > maxValue)
						maxValue = Number(this.sourceGraph.readings[i].data);
					n++;
				}
			}
		}


		avgValue = sumValue/n;

		this.infoField.html("\
							<table>\
								<tr>\
									<td>Total</td>\
									<td class='bold'>"+sumValue.toFixed(2)+"</td>\
								</tr>\
								<tr>\
									<td>Max</td>\
									<td class='bold'>"+maxValue.toFixed(2)+"</td>\
								</tr>\
								<tr>\
									<td>Avg</td>\
									<td class='bold'>"+avgValue.toFixed(2)+"</td>\
								</tr>\
							</table>");
	}
}

GraphInterval.prototype.resetInterval = function()
{
	if(typeof this.scaleBar !== "undefined")
	{
		this.selection.selectAll("svg").remove();
		this.scaleBar.resetScale();
		this.hideAccept();
	}
}

GraphInterval.prototype.calculateWidth = function(deltaT)
{
	var x = d3.time.scale().domain([firstInstant, lastInstant]).range([0, this.getWidth()]);
	return x(+(deltaT)+(+(firstInstant)));
}

GraphInterval.prototype.copySelectionData = function()
{
	this.dataInterval = [];

	for(var i=this.interval.indexBegin;i<this.interval.indexEnd+1;i++)
	{
		var aux = [];
		
		aux.data = this.sourceGraph.readings[i].data * this.scaleBar.scale;
		aux.instant = this.sourceGraph.readings[i].instant;

		this.dataInterval.push(aux);
	}
	this.deltaTime = this.dataInterval[this.dataInterval.length-1].instant-this.dataInterval[0].instant;
}

GraphInterval.prototype.changedScale = function()
{
	this.selection.on("dblclick", null);
	this.copySelectionData();
	this.updateInfo(true);

	this.renderDataInterval();
}

GraphInterval.prototype.renderDataInterval = function(color)
{
	if(typeof color === "undefined")
	{
		color = tEngine.getColor(this.sourceGraph.dataColor)
	}
	this.selection.selectAll("svg").remove();
	this.tgt = this.selection.append("svg:svg").attr("width", "100%").attr("height", "100%");
	this.sourceGraph.renderLines(this.dataInterval, color, this.tgt, this.interval.pxBegin);
}

GraphInterval.prototype.acceptSelection = function()
{
	var n = 0;
	for(var i=this.interval.indexBegin;i<this.interval.indexEnd+1;i++)
	{
		this.sourceGraph.readings[i].data = this.dataInterval[n].data;
		this.sourceGraph.readings[i].instant = this.dataInterval[n].instant;
		n++;
	}
	this.sourceGraph.calculateMax();
	this.sourceGraph.calculateMin();
	this.selection.selectAll("svg").remove();
	tEngine.refreshGraphsWithChannel(this.sourceGraph.channel);
	this.sourceGraph.pannable = true;
	this.draggable = true;
	this.hideAccept();
	this.scaleBar.resetScale();
	this.closeSelection();
	this.sourceGraph.refreshAnnotations();
}

GraphInterval.prototype.hideScaleBar = function()
{
	this.scaleBar.attr("class", "scaleBar pickerTools hidden");
}

GraphInterval.prototype.hideAccept = function()
{
	this.acceptButton.attr("class", "acceptButton pickerTools hidden");
}

GraphInterval.prototype.showAccept = function()
{
	this.acceptButton.attr("class", "acceptButton pickerTools");
}

GraphInterval.prototype.drawSelection = function()
{
	if(this.sourceGraph.createdInterval == false && this.sourceGraph.selectingInterval == true)
	{

		this.graph = d3.select("#"+this.sourceGraph.element.id+" .graph svg");

		var xBegin = this.interval.pxBegin;
		var xEnd = this.interval.pxEnd;

		var graphSelection = this.graph.append("g")
			.attr("class", "graphSelection");


		var graphDiv = d3.select("#"+this.sourceGraph.element.id);

	   	var thisGraph = this;

		if(this.createdTools == false)
		{
			this.sourceGraph.createdInterval = true;

			this.createdTools = true;

			this.selection = graphDiv.append("div")
							.attr("id", "selection")
							.style("left", xBegin+"px")
							.style("visibility", "hidden")
							.style("height", this.sourceGraph.getHeight()-this.sourceGraph.footerHeight+"px")
							.attr("class", "graphSelection pickerTools")
							.on("dblclick", function(event){ thisGraph.annotate.call(thisGraph, event) })
							.style("z-index", tEngine.lastZIndex++);


			this.element = this.selection[0][0];

			this.removeButton = this.selection.append("div")
				.attr("id", "remove")
				.attr("class", "removeButton pickerTools")
				.on("click", function(event){ thisGraph.closeSelection.call(thisGraph, event) });

			this.acceptButton = this.selection.append("div")
				.attr("id", "accept")
				.attr("class", "acceptButton pickerTools hidden")
				.on("click", function(event){ thisGraph.acceptSelection.call(thisGraph, event) });

			var sumValue = "Calculating...";
			var maxValue = "Calculating...";
			var avgValue = "Calculating...";


			this.infoField = graphDiv.append("div")
							.attr("id", "info")
							.style("position", "absolute")
							.attr("class", "infoField pickerTools")
							.html("\
								<table>\
									<tr>\
										<td>Sum</td>\
										<td class='bold'>"+sumValue+"</td>\
									</tr>\
									<tr>\
										<td>Max</td>\
										<td class='bold'>"+maxValue+"</td>\
									</tr>\
									<tr>\
										<td>Avg</td>\
										<td class='bold'>"+avgValue+"</td>\
									</tr>\
								</table>");

			if(this.cloneOf != -1)
			{
				this.infoField.attr("class", "infoField pickerTools hidden");
			}

			InteractiveObject.call(this, this.selection[0][0]);
			tEngine.interactiveObjectList[this.identifier] = this;

			this.scaleBar = this.selection.append("div")
				.attr("id", "scaleBar")
				.style("top", (this.sourceGraph.getHeight()-this.sourceGraph.footerHeight)/2-1.5+"px")
				.attr("class", "scaleBar pickerTools");

			this.scaleBar = new ScaleBar(this.scaleBar[0][0], this, this.sourceGraph.element.id+"selectionScaleBar");
			tEngine.interactiveObjectList[this.sourceGraph.element.id+"selectionScaleBar"] = this.scaleBar;

			this.selection.on("mousemove", function() 
			{
				thisGraph.sourceGraph.mouseMove.call(thisGraph.sourceGraph, d3.mouse(thisGraph.sourceGraph.element));
			});
				//
		}
	}
}

GraphInterval.prototype.touchStarted = function(touch)
{
}

GraphInterval.prototype.initClone = function(source)
{
	this.z = 101;

	this.sourceGraph = source.sourceGraph;
	this.inputField = undefined;
	this.label = undefined;
	this.removeButton = undefined;
	this.acceptButton = undefined;

	this.cloneOf = source;

	document.body.appendChild(this.element);

	this.selection = d3.select("#"+this.element.id);
	
	this.scaleBar = undefined;
	this.createdTools = false;

	this.dataInterval = source.dataInterval;

	this.draggingScale = false;
	this.scaleInitialPos = undefined;
}

GraphInterval.prototype.touchEnded = function(touch)
{
	if(this.positionLink != -1 && this.cloneOf != -1)
	{
		this.positionLink = -1;

		if(this.link != -1)
		{
			// this.link is the target graph
			this.link.selectedInterval.closeSelection();

			this.link.selectedInterval = new GraphInterval(this.link, this);

			if(this.getPositionX()+this.getWidth() < this.link.getPositionX()+this.link.getWidth()-20) // if end of selection inside graph
			{
				this.link.selectedInterval.interval.pxBegin = this.getPositionX()-this.link.getPositionX();
			}
			else
			{
				this.link.selectedInterval.interval.pxBegin = this.link.getWidth()-this.getWidth()-20;
			}

			this.link.selectedInterval.interval.indexBegin = this.link.indexForX(this.link.selectedInterval.interval.pxBegin);
			this.link.selectedInterval.interval.indexEnd   = this.link.selectedInterval.interval.indexBegin+this.dataInterval.length-1;

			this.link.selectedInterval.interval.pxEnd = this.link.xForIndex(this.link.selectedInterval.interval.indexEnd);

			this.link.createdInterval = false;
			this.link.selectingInterval = true;

			this.link.selectedInterval.dataInterval = [];

			var n=0;
			for(var i=this.link.selectedInterval.interval.indexBegin;i<this.link.selectedInterval.interval.indexEnd+1;i++)
			{
				var aux = [];

				aux.data = this.dataInterval[n++].data;
				aux.instant = this.link.dataSource.readings[i].instant;

				this.link.selectedInterval.dataInterval.push(aux);
			}

			this.link.selectedInterval.update();
			this.link.selectedInterval.drawSelection();

			this.link.selectedInterval.selection.style("visibility", "visible");

			this.link.selectedInterval.renderDataInterval(tEngine.getColor(this.sourceGraph.dataColor));

			this.link.selectedInterval.showAccept();
			// this.link.selectedInterval.draggable = false;
			// this.link.selectedInterval.scaleBar.remove();
			this.link.selectedInterval.cloneOf = this;

			delete tEngine.interactiveObjectList[this.identifier];

			this.link.selectedInterval.scaleBar.destroy();
			this.link.selectedInterval.selection.on("dblclick", null);

			this.link.selectingInterval = false;
			this.link.pannable = false;
			this.link.pinchable = false;

			this.link.selectedInterval.updateSelection();

			// console.log(this.element.id);
			test = $("#"+this.element.id);
			// console.log(test);
			test.remove();
		}
		else
		{
			test = $("#"+this.element.id);
			// console.log(test);
			test.remove();
		}
	}
}

GraphInterval.prototype.hold = function(touch)
{
	if(this.draggable == true)
	{
		this.updateLastPosition();
		if(this.touchCount == 1)
		{
			this.sourceGraph.pannable = false;
			this.sourceGraph.pinchable = false;
			this.infoField.remove();
			this.scaleBar.destroy();

			if(this.cloneOf == -1)
				this.copySelectionData();

			this.selection.selectAll("svg").remove();
			this.tgt = this.selection.append("svg:svg").attr("width", "100%").attr("height", "100%").style("cursor", "move");
			this.sourceGraph.renderLines(this.dataInterval, tEngine.getColor(this.sourceGraph.dataColor), this.tgt, this.interval.pxBegin);

			this.animations = [];

			var clone = this.createInstance();
			touch.target = clone;
			clone.cloneOf = this;
			clone.draggable = true;
			clone.destroyOnRelease = true;

			// start to drag element
			clone.element.style.opacity = 0.7;
			clone.element.style.zIndex = tEngine.lastZIndex;
			tEngine.lastZIndex += 1;
			clone.bindPositionToTouch(touch);

			tEngine.interactiveObjectList[clone.identifier] = clone;

			this.closeSelection();

			if(touch.over.length > 1) // hovering other thing
			{
				this.link = -1;
				for(var x in touch.over)
				{
					var t = touch.over[x];
					if(t.ioType == "Graph")
					{
						clone.link = t;
						t.dragOver();
					}
				}
			}
		}
	}
}

GraphInterval.prototype.updatePositionLink = function()
{
	var deltaMoved = this.positionLink.deltaMoved();
	if(this.link == -1)
		this.updatePosition([this.lastPosition[0]+deltaMoved[0], this.lastPosition[1]+deltaMoved[1]]);

	else if(this.isOver(this.link) == true)
	{
		var outside = false;
		var w = this.interval.pxBegin-this.interval.pxEnd;
		var indexBegin = this.link.indexForX(this.positionLink.position[0]-this.link.getPositionX());

		if(this.getPositionX() < this.link.getPositionX()) // dragging with left off the graph
		{
			delta = (this.getPositionX()-this.link.getPositionX())*10000;
			outside = true;
		}
		else if(this.getPositionX()+this.getWidth() > this.link.getPositionX()+this.link.getWidth())
		{
			delta = (this.getPositionX()+this.getWidth()-this.link.getPositionX()-this.link.getWidth())*10000;
			outside = true;
		}
		if(outside == true)
		{
			if(this.link.timelineLocked == false)
			{
				this.link.timeInterval.pan(delta);
				this.link.refreshTimeInterval();
			}
			else
			{
				tEngine.panLocked(delta, this.link.dataSource.source);
			}
		}

		this.updatePosition([this.link.xForIndex(indexBegin)+this.link.getPositionX()+w/2, this.link.getPositionY()]);
		
		var max = this.link.maxIndexRendered();

	}
	else
	{
		this.link = -1;
		this.updatePosition([this.lastPosition[0]+deltaMoved[0], this.lastPosition[1]+deltaMoved[1]]);
	}
}

GraphInterval.prototype.pan = function(touch)
{
	if(this.dragging == true)
	{
		if(touch.over.length > 1) // hovering other thing
		{
			this.link = -1;
			for(var x in touch.over)
			{
				var t = touch.over[x];
				if(t.ioType == "Graph" && t.dataSource == this.sourceGraph.dataSource)
				{
					this.link = t;
					t.dragOver();
				}
			}
		}
	}
	else
	{
		if(this.sourceGraph.pannable == true)
		{
			touch.setTarget(this.sourceGraph);
			this.sourceGraph.pan(touch);
		}
	}
}
GraphInterval.prototype.pinch = function(touch, distance, angle)
{

}

GraphInterval.prototype.mouseMove = function(pos)
{

}