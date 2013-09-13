function Animation(element)
{
	this.element = element;
	this.duration = 1000;
	this.done = 0;
	this.timestamp = Math.round(new Date().getTime());
	this.animatedProperty = -1;
	this.animateFrom = -1;
	this.animateTo   = -1;
	this.animating = false;
	this.unit = "";
	this.elementOwner = undefined;
	this.callbackFunction = undefined;
	this.varType = "int";
}

Animation.prototype.start = function ()
{
	this.animating = true;
	if(this.element != -1 && this.animatedProperty != -1 && this.animateFrom == -1)
	{
		if(typeof this.element[this.animatedProperty] == 'string')
			this.animateFrom = parseInt(this.element[this.animatedProperty].match(/\d+/));
		else
			this.animateFrom = this.element[this.animatedProperty];
	}
}

Animation.prototype.stop = function ()
{
	this.done = 0;
	this.animating = false;
}

Animation.prototype.update = function ()
{
	if(this.animating == true)
	{
		this.done = this.timeSinceStarted();
		if(this.element != -1 && this.animatedProperty != -1)
		{
			if(this.done >= this.duration)
			{
				this.element[this.animatedProperty] = this.animateTo+this.unit;
				this.elementOwner.somethingChanged();
				if(this.callbackFunction != undefined)
					this.callbackFunction.call(this.elementOwner);
				this.stop();

			}
			else
			{
				if(this.varType == "int")
				{
					this.element[this.animatedProperty] = parseInt(this.animateFrom-
							((this.animateFrom-this.animateTo)/this.duration*this.done))+this.unit;
				}
				else if(this.varType == "float")
				{
					this.element[this.animatedProperty] = parseFloat(this.animateFrom-
							((this.animateFrom-this.animateTo)/this.duration*this.done))+this.unit;	
				}
				this.elementOwner.somethingChanged();
				// if(this.callbackFunction != undefined)
					// this.callbackFunction.call(this.elementOwner);
				// this.elementOwner.animationCallback();
			}
			// console.log(this.element[this.animatedProperty]);
			// console.log(this.element[this.animatedProperty]);
		}
	}
}

Animation.prototype.timeSinceStarted = function ()
{
	var now = new Date().getTime();
	return now-this.timestamp;
}
