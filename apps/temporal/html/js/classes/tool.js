function Tool(element)
{
	InteractiveObject.call(this, element);

	this.isStatic = true;
	this.highlightDelta = 5;

	this.dropFunction = undefined;
	this.iType = "Tool";
	this.draggable = false;
}

Tool.prototype = tEngine.clone(InteractiveObject.prototype);
Tool.prototype.parent = InteractiveObject.prototype;

Tool.prototype.constructor = InteractiveObject;


Tool.prototype.update = function()
{
	// this.renderData();
	
	if(this.draggable == true)
	{
		if(this.positionLink != -1)
		{
			// console.log("dragging");
			// console.log(this.positionLink.touch.pageX, this.positionLink.touch.pageY)
			// console.log(this.element);
			this.updatePositionLink();
		}
		for(x in this.animations)
		{
			this.animations[x].update();
		}
	}
}

Tool.prototype.moveHighlight = function()
{
	if(this.draggable == true)
	{
		this.lastPosition[0] -= this.highlightDelta;
		this.lastPosition[1] -= this.highlightDelta;
	}
}


Tool.prototype.pan = function(touch)
{
	if(this.draggable == true && this.locked == false)
	{

		if(this.touchCount == 1)
		{
			this.target = -1;
			if(touch.over.length > 1)
			{
				for(var x in touch.over)
				{
					var t = touch.over[x];
					if(t.element.id != this.element.id)
					{
						if(t.iType == "Graph")
						{
							t.dragOver();
							this.target = t;
							break;
						}
					}
				}
			}
			this.element.style.zIndex = tEngine.lastZIndex;
			tEngine.lastZIndex += 1;
			this.bindPositionToTouch(touch);
		}
	}
}


Tool.prototype.hold = function(touch)
{
	// console.log("hold");
	// if(this.draggable == true)
	// {
	// 	if(this.touchCount == 1)
	// 	{
	// 		this.element.style.zIndex = tEngine.lastZIndex;
	// 		tEngine.lastZIndex += 1;
	// 		// this.animations = [];
	// 		this.bindPositionToTouch(touch);
	// 	}
	// }
	// else
	// {
	// 	var clone = this.createInstance();
	// 	touch.target = clone;
	// 	clone.draggable = true;

	// 	var animation = new Animation(clone.element.style);
	// 	animation.animatedProperty = "opacity";
	// 	animation.animateFrom = 1;
	// 	animation.animateTo = 0.7;
	// 	animation.duration = 100;
	// 	animation.unit = "";
	// 	animation.varType = "float";
	// 	animation.elementOwner = clone;
	// 	// animation.callbackFunction = this.moveHighlight;
	// 	animation.start();
	// 	// console.log(animation);

	// 	clone.animations.push(animation);

	// 	// clone.updatePosition([380,10]);
	// 	tEngine.interactiveObjectList[clone.element.id] = clone;
	// 	// console.log(clone);
	// 	document.body.appendChild(clone.element);
	// }
}

Tool.prototype.touchStarted = function(touch)
{
	// console.log("touchStarted");

	if(this.draggable == false && this.locked == false)
	{
		var clone = this.createInstance();
		document.body.appendChild(clone.element);
		touch.target = clone;
		clone.draggable = true;

		// start to drag element
		clone.element.style.zIndex = tEngine.lastZIndex;
		tEngine.lastZIndex += 1;
		clone.bindPositionToTouch(touch);
		clone.highlight();

		var animation = new Animation(clone.element.style);
		animation.animatedProperty = "opacity";
		animation.animateFrom = 1;
		animation.animateTo = 0.7;
		animation.duration = 100;
		animation.unit = "";
		animation.varType = "float";
		animation.elementOwner = clone;
		// animation.callbackFunction = this.moveHighlight;
		animation.start();
		// console.log(animation);

		clone.animations.push(animation);

		// clone.updatePosition([380,10]);
		tEngine.interactiveObjectList[clone.element.id] = clone;
		// console.log(clone);
	}
}

Tool.prototype.touchEnded = function(touch)
{
	// console.log("touchEnded");
	if(this.draggable == true && this.locked == false)
	{
		this.locked = true;
		var animation = new Animation(this.element.style);
		animation.animatedProperty = "opacity";
		animation.animateFrom = 0.7;
		animation.animateTo = 0.0;
		animation.duration = 500;
		animation.unit = "";
		animation.varType = "float";
		animation.elementOwner = this;
		animation.callbackFunction = this.suicide;
		animation.start();
		// console.log(animation);

		this.animations.push(animation);
	}
	if(this.target != -1 && this.dropFunction != undefined)
	{
		this.dropFunction();
	}
}