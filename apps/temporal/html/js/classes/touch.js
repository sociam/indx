function Touch(event) 
{
	this.target  = -1;
	this.over    = [];
	this.startPosition = [event.pageX, event.pageY];
	this.lastPosition  = [event.pageX, event.pageY];
	this.position      = [event.pageX, event.pageY];
	this.timestamp = Math.round(new Date().getTime());
	this.handled = false;
	this.touch   = event;
	this.holdDelay = 300;
	this.firedHold = false;
	this.firedSwipe = false;
	this.cancelHold = false;
	this.holdMovementThreshold = 3;
}

Touch.prototype.setTarget = function(target)
{
	this.target = target;
}

Touch.prototype.moved = function ()
{
	if(this.lastPosition[0] != this.position[0] || this.lastPosition[1] != this.position[1]) 
		return true;
	else 
		return false;
}

Touch.prototype.deltaMoved = function ()
{
	var delta = [this.position[0] - this.startPosition[0], this.position[1] - this.startPosition[1]]; 
	return delta;
}

Touch.prototype.distance = function (pointA, pointB)
{
	var dx = pointA[0]-pointB[0];
	var dy = pointA[1]-pointB[1];
	var dist = Math.sqrt(dx*dx+dy*dy);
	return dist;
}

Touch.prototype.getOtherTouch = function ()
{
	var targetTouchList = this.target.isTarget;

	for(x in targetTouchList) // get the list of touches on the target interactiveObject
	{
		if(targetTouchList[x].touch.identifier != this.touch.identifier)
		{
			return targetTouchList[x];
		}
	}
	return -1;
}

Touch.prototype.deltaPinch = function (otherTouch)
{
	var startDistance = this.distance(this.startPosition, otherTouch.startPosition);
	var distance      = this.distance(this.position, otherTouch.position);
	return distance-startDistance;
}



Touch.prototype.thresholdSwipeUp = function (value)
{
	var delta = this.deltaMoved();
	return !(-delta[1] < value);
}

Touch.prototype.thresholdSwipeDown = function (value)
{
	var delta = this.deltaMoved();
	return !(delta[1] < value);
}

Touch.prototype.thresholdSwipeLeft = function (value)
{
	var delta = this.deltaMoved();
	return !(-delta[0] < value);
}

Touch.prototype.thresholdSwipeRight = function (value)
{
	var delta = this.deltaMoved();
	return !(delta[0] < value);
}

Touch.prototype.thresholdMoved = function (value)
{
	var delta = this.deltaMoved();
	return !(delta[0]*delta[0]+delta[1]*delta[1] < value*value);
}


Touch.prototype.timeSinceStarted = function ()
{
	var now = new Date().getTime();
	return now-this.timestamp;
}


Touch.prototype.updatePosition = function (position)
{
	this.position = position;
}

Touch.prototype.refreshPosition = function (position)
{
	this.lastPosition = this.position;
}

Touch.prototype.angle = function (pointA, pointB)
{
	var deltaX = pointB[0]-pointA[0];
	var deltaY = pointB[1]-pointA[1];

	return Math.atan2(deltaY, deltaX)*180/Math.PI;
}

Touch.prototype.isFirstTarget = function ()
{
	var targetList = this.target.isTarget;
	for(x in targetList)
	{
		if(targetList[x] == this)
			return true;
		else
			return false;
	}
	return false;
}

Touch.prototype.firePinch = function ()
{
	if(this.target != -1)
	{
		if(this.target.isTargetCount() == 2)
		{
			if(this.isFirstTarget() == true)
			{
				var otherTouch = this.getOtherTouch();
				var deltaPinch = this.deltaPinch(otherTouch);
				var pinchAngle = this.angle(this.position, otherTouch.position);
				if(this.target.pinchable == true)
					this.target.pinch(this, deltaPinch, pinchAngle);
			}
		}
	}
}

Touch.prototype.fireHold = function ()
{
	if(this.firedHold == false && this.target != -1)
	{
		if(this.timeSinceStarted() >= this.holdDelay && this.cancelHold == false)
		{

			if(this.thresholdMoved(this.holdMovementThreshold) == false)
			{
				
				this.target.hold(this);
			}
			this.firedHold = true;
		}
	}
}

Touch.prototype.fireSwipe = function ()
{
	if(this.firedSwipe == false && this.target != -1)
	{
		if(this.thresholdMoved(this.holdMovementThreshold) == true)
		{
			this.firedSwipe = true;
			this.target.swipe(this);
		}
		if(this.thresholdSwipeLeft(this.holdMovementThreshold) == true)
		{
			this.firedSwipe = true;
			this.target.swipeLeft(this);
		}
		if(this.thresholdSwipeRight(this.holdMovementThreshold) == true)
		{
			this.firedSwipe = true;
			this.target.swipeRight(this);
		}
		if(this.thresholdSwipeUp(this.holdMovementThreshold) == true)
		{
			this.firedSwipe = true;
			this.target.swipeUp(this);
		}
		if(this.thresholdSwipeDown(this.holdMovementThreshold) == true)
		{
			this.firedSwipe = true;
			this.target.swipeDown(this);
		}
	}
}

Touch.prototype.firePan = function ()
{
	if(this.target != -1)
	{
		if(this.moved() == true)
		{
			if(this.target.pannable == true)
			{
				this.target.pan(this);
			}
			this.refreshPosition();
		}
	}
}

Touch.prototype.end = function ()
{
	if(this.target != -1)
	{
		this.target.touchEnded(this);
		this.target.removeTouchTarget(this);
	}
	for(x in this.over)
	{
		this.over[x].decreaseTouchCount();
	}
}


Touch.prototype.handle = function ()
{
	if(this.handled == false)
	{
		var front = ["", -1];
		var element = document.elementFromPoint(tEngine.cursorPosition[0], tEngine.cursorPosition[1]);
		var target = undefined;
		if(this.over.length > 0)
		{
			for(x in this.over)
			{
				if(this.over[x].element == element)
				{
					target = this.over[x];
				}
				else if(this.over[x].element == element.parentNode)
				{
					target = this.over[x];
				}
			}

			if(typeof target !== "undefined")
			{
				this.target = target;
				this.target.touchStarted(this);
			}
			else
			{
				for(x in this.over)
				{
					if(front[1] == -1)
					{
						front[0] = this.over[x];
						front[1] = this.over[x].z;
						continue;
					}
					if(this.over[x].z > front[1])
					{
						front[0] = this.over[x];
						front[1] = this.over[x].z;
					}
				}
				this.target = front[0];
				this.target.touchStarted(this);
			}
		}
		if(this.target != -1)
			this.target.addTouchTarget(this);
		this.handled = true;
	}
}
/*
Touch event vocabulary:
- touchStarted
- touchMoved
- touchEnded
*/