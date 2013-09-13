function Button(element)
{
	InteractiveObject.call(this, element);

	this.isStatic = true;
}

Button.prototype = tEngine.clone(InteractiveObject.prototype);
Button.prototype.parent = InteractiveObject.prototype;

Button.prototype.constructor = InteractiveObject;


Button.prototype.touchStarted = function(touch)
{
	tEngine.switchDebug();
}