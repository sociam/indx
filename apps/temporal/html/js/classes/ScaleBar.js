function ScaleBar(element, owner, identifier)
{
	this.d3Element = element;
	this.owner = owner;
	this.identifier = identifier;
	InteractiveObject.call(this, element[0][0]);
	this.scale = 1;
	this.changedScale = false;

	var top = this.d3Element.style("top");
	this.initialCenterY = parseInt(top.match(/\d+/));
}

ScaleBar.prototype = tEngine.clone(InteractiveObject.prototype);
ScaleBar.prototype.parent = InteractiveObject.prototype;

ScaleBar.prototype.constructor = InteractiveObject;

ScaleBar.prototype.resetScale = function()
{
	this.centerY = this.initialCenterY;
	this.scale = 1;
	this.changedScale = false;
	this.d3Element.style("top", this.centerY+"px");
}

ScaleBar.prototype.destroy = function()
{
	delete tEngine.interactiveObjectList[this.identifier];
	this.d3Element.remove();
}

ScaleBar.prototype.touchStarted = function(touch)
{
	this.owner.sourceGraph.pannable = false;
	this.owner.sourceGraph.pinchable = false;
	var top = this.d3Element.style("top");
	this.centerY = parseInt(top.match(/\d+/));;

}

ScaleBar.prototype.touchEnded = function(touch)
{
	this.owner.sourceGraph.pannable = true;
	this.owner.sourceGraph.pinchable = true;
	var top = this.d3Element.style("top");
	this.centerY = parseInt(top.match(/\d+/));;
}

ScaleBar.prototype.pan = function(touch)
{
	var delta = touch.startPosition[1] - touch.position[1];
	var dp = this.centerY-delta;
	
	if(dp < 0)
		dp = 0;
	else if(dp > 117)
		dp = 117;
	
	this.d3Element.style("top", dp+"px");

	var s = d3.scale.linear().domain([0, 117]).range([2, 0]);
	this.scale = s(dp);
	if(this.scale != 1)
	{
		this.changedScale = true;
		this.owner.showAccept();
	}
	else
	{
		this.changedScale = false;
		this.owner.hideAccept();	
	}
	this.owner.changedScale();
}