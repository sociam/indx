function InteractiveObject(element) 
{
	this.element = element;
    this.link = -1; // other object that this object is linked to
    this.positionLink = -1; // the touch that this object position is linked to
    this.touchCount = 0; // number of touches over this object
    var box = this.element.getBoundingClientRect();
    this.setSize([box.width, box.height]);
    this.closing = false;
    this.setPosition([box.left, box.top]);
    this.updateLastPosition();
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
	this.iType = "InteractiveObject"; // type of the object
	this.target = -1; // target object (drag and drop)
	this.cloneOf = -1; // pointer to original object
	this.isStatic = false;
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

InteractiveObject.prototype.moveHighlight = function()
{
	this.lastPosition[0] -= this.highlightDelta;
	this.lastPosition[1] -= this.highlightDelta;
}

InteractiveObject.prototype.highlight = function()
{
	if(this.highlighted == false)
	{
		this.highlighted = true;

		var animation = new Animation(this.element.style);
		animation.animatedProperty = "top";
		animation.animateTo = this.position[1]-5;
		animation.duration = 100;
		animation.unit = "px";
		animation.elementOwner = this;
		animation.callbackFunction = this.moveHighlight;
		animation.start();
		// console.log(animation);

		this.animations.push(animation);

		animation = new Animation(this.element.style);
		animation.animatedProperty = "left";
		animation.animateTo = this.position[0]-5;
		animation.duration = 100;
		animation.unit = "px";
		animation.elementOwner = this;
		animation.start();
		// console.log(animation);

		this.animations.push(animation);
	}
}

InteractiveObject.prototype.backToNormal = function()
{
	if(this.highlighted == true)
	{
		// console.log("backToNormal");
		this.highlighted = false;
		this.lastPosition[0] += this.highlightDelta;
		this.lastPosition[1] += this.highlightDelta;
	}
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

InteractiveObject.prototype.setLastPosition = function(position)
{
	this.lastPosition = position;
}
InteractiveObject.prototype.getLastPosition = function()
{
	return this.lastPosition;
}

InteractiveObject.prototype.setPosition = function(position)
{
	// position[0] = parseInt(position[0].match(/\d+/));
	// position[1] = parseInt(position[1].match(/\d+/));
	this.position = position;
}

InteractiveObject.prototype.setSize = function(size)
{
	this.size = size;
}
InteractiveObject.prototype.getSize = function(size)
{
	return this.size;
}

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
	this.lastPosition = this.position;
}

InteractiveObject.prototype.somethingChanged = function()
{
	var jbox = $(this.element).offset();
	// console.log(test);
	var box = this.element.getBoundingClientRect();

	this.size[0] = box.width;
	this.size[1] = box.height;

	this.position[0] = jbox.left;
	this.position[1] = jbox.top;

	// this.position[0] = parseInt(this.element.style.left.match(/\d+/));
	// if(!tEngine.isNumber(this.position[0]))
	// {
	// 	var styleClass = this.getStyle("."+this.element.className);
	// 	if(typeof styleClass !== "undefined")
	// 		this.position[0] = parseInt(styleClass.style.left.match(/\d+/));
	// }
	// this.position[1] = parseInt(this.element.style.top.match(/\d+/));
	// if(!tEngine.isNumber(this.position[1]))
	// {
	// 	var styleClass = this.getStyle("."+this.element.className);
	// 	if(typeof styleClass !== "undefined")
	// 		this.position[1] = parseInt(styleClass.style.top.match(/\d+/));
	// }
}


InteractiveObject.prototype.updatePosition = function(position)
{
	this.position = position;
	// console.log(position);

	this.element.style.left = position[0]+"px";
	this.element.style.top  = position[1]+"px";
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

