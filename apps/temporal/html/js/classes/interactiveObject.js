function InteractiveObject(element) 
{
	this.element = element;
    this.link = -1; // other object that this object is linked to
    this.positionLink = -1; // the touch that this object position is linked to
    this.touchCount = 0; // number of touches over this object
    var box = this.element.getBoundingClientRect();
    // this.setSize([box.width, box.height]);
    this.closing = false;

    this.lastPosition = [];
    // this.lastPosition[0] = 0;
    // this.lastPosition[1] = 0;

    this.size = [];
    this.sizeCached = false;

    // this.setPosition([box.left, box.top]);
    // this.updateLastPosition();
	this.isTarget = []; // array of touches that this object is target
	this.draggable = true; // if is draggable
	this.pinchable = true;
	this.pannable = true;
	this.dragging = false; // if is dragging
	this.pinching = false; // if is pinching
	this.animations = []; // array of animations 
	this.highlighted = false; // if it is highlighted
	this.highlightDelta = 10; // number of pixels that it will move when highlighted
	this.clonesCreated = 0; // number of clones created
	this.locked = false;
	this.destroyOnRelease = false; // when release the touch from this object, destroy it?
	this.ioType = "InteractiveObject"; // type of the object
	this.target = -1; // target object (drag and drop)
	this.cloneOf = -1; // pointer to original object
	this.isStatic = false;
	this.isSVG = false;
}

InteractiveObject.prototype.setPosition = function(position)
{
	d3.select(this.element).style("left", position[0]+"px");
	d3.select(this.element).style("top", position[1]+"px");
	// $(this.element).css("left", position[0]+"px");
	// $(this.element).css("top", position[1]+"px");
}

InteractiveObject.prototype.setPositionX = function(pos)
{
	$(this.element).css("left", pos+"px");
}

InteractiveObject.prototype.setPositionY = function(pos)
{
	$(this.element).css("top", pos+"px");
}

InteractiveObject.prototype.getPositionX = function()
{
	return $(this.element).offset().left;
}

InteractiveObject.prototype.getPositionY = function()
{
	return $(this.element).offset().top;
}

InteractiveObject.prototype.cacheSize = function()
{
	if(this.isSVG == false)
	{
		this.size[0] = $(this.element).width();
		this.size[1] = $(this.element).height();
	}
	else
	{
		this.size[0] = Number($(this.element).attr("width"));
		this.size[1] = Number($(this.element).attr("height"));
	}
	this.sizeCached = true;
}

InteractiveObject.prototype.getWidth = function()
{
	if(this.sizeCached == false)
	{
		this.cacheSize();
	}
	return this.size[0];
}

InteractiveObject.prototype.getHeight = function()
{	
	if(this.sizeCached == false)
	{
		this.cacheSize();
	}
	return this.size[1];
}


InteractiveObject.prototype.setWidth = function(size)
{
	$(this.element).css("width", size+"px");
	this.size[0] = size;
}

InteractiveObject.prototype.setHeight = function(size)
{
	$(this.element).css("height", size+"px");
	this.size[1] = size;
}

InteractiveObject.prototype.isOver = function(target)
{
	for(var x in this.isTarget)
	{
		var touch = this.isTarget[x];
		for(var x in touch.over)
		{
			var t = touch.over[x];
			if(t == target)
			{
				return true;
			}
		}
	}
	return false;
}

InteractiveObject.prototype.bindPositionToTouch = function(touch)
{
	if(this.dragging == false)
	{
		this.positionLink = touch;
		this.dragging = true;
	}
}

InteractiveObject.prototype.unbindPosition = function()
{
	this.updateLastPosition();
	this.positionLink = -1;
	this.dragging = false;
}



// InteractiveObject.prototype.setSize = function(size)
// {
// 	this.size = size;
// }

InteractiveObject.prototype.increaseTouchCount = function()
{
	this.touchCount += 1;
}
InteractiveObject.prototype.decreaseTouchCount = function()
{
	this.touchCount -= 1;
}

InteractiveObject.prototype.updateLastPosition = function()
{
	this.lastPosition = [];
	this.lastPosition[0] = this.getPositionX();
	this.lastPosition[1] = this.getPositionY();
}


InteractiveObject.prototype.updatePosition = function(position)
{
	this.setPosition(position);

	this.element.style.left = this.getPositionX()+"px";
	this.element.style.top  = this.getPositionY()+"px";

	// console.log(this.element.style)
}

InteractiveObject.prototype.updatePositionLink = function()
{
	var deltaMoved = this.positionLink.deltaMoved();
	this.updatePosition([this.lastPosition[0]+deltaMoved[0], this.lastPosition[1]+deltaMoved[1]]);
}


InteractiveObject.prototype.addTouchTarget = function (touch)
{
	this.isTarget[touch.touch.identifier] = touch;
}

InteractiveObject.prototype.removeTouchTarget = function (touch)
{

	delete this.isTarget[touch.touch.identifier];
}

InteractiveObject.prototype.update = function()
{

}

InteractiveObject.prototype.isTargetCount = function ()
{
	var count = 0;
	for(x in this.isTarget) count++;
	return count;
}
InteractiveObject.prototype.createInstance = function()
{
	var clone = tEngine.clone(this);
	clone.element = this.element.cloneNode(true);
	this.clonesCreated += 1;
	clone.touchCount = 0;
	clone.element.id = clone.element.id+this.clonesCreated;
	
	if(typeof this.identifier !== "undefined")
	{
		clone.identifier = this.identifier+this.clonesCreated;
	}
	clone.cloneOf = this;

	clone.lastPosition = this.lastPosition.slice(0);

	if(typeof clone.initClone !== "undefined")
	{
		clone.initClone(this);
	}

	return clone;
}

InteractiveObject.prototype.suicide = function()
{
	if(document.getElementById(this.element.id))
	{
		document.body.removeChild(this.element);
	}
	tEngine.removeFromInteractiveObjectList(this.element.id);
}

InteractiveObject.prototype.getStyle = function(className) {
    var classes = document.styleSheets[0].rules || document.styleSheets[0].cssRules;
    for(var x=0;x<classes.length;x++) 
    {
        if(classes[x].selectorText==className) 
        {
                if((classes[x].cssText)) 
                	return (classes[x])
                else 
                	return (classes[x].style);
        }
    }
}


/////////////////////////////////////////////////////
//                  Events
/////////////////////////////////////////////////////

InteractiveObject.prototype.touchStarted = function(touch)
{
	// console.log("touchStarted");
}

InteractiveObject.prototype.touchEnded = function(touch)
{
	// console.log("touchEnded");
}

InteractiveObject.prototype.hold = function(touch)
{
	// console.log("hold");
}

InteractiveObject.prototype.swipe = function(touch)
{
	// console.log("swipe");
}
InteractiveObject.prototype.swipeRight = function(touch)
{
	// console.log("swipeRight");
}
InteractiveObject.prototype.swipeLeft = function(touch)
{
	// console.log("swipeLeft");
}
InteractiveObject.prototype.swipeUp = function(touch)
{
	// console.log("swipeUp");
}
InteractiveObject.prototype.swipeDown = function(touch)
{
	// console.log("swipeDown");
}
InteractiveObject.prototype.pan = function(touch)
{
	// console.log("pan");
}
InteractiveObject.prototype.pinch = function(touch, distance, angle)
{
	// console.log("pinch");
}
InteractiveObject.prototype.mouseMove = function(pos)
{
	// console.log("mouseMove");
}

