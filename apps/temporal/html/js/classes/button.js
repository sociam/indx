function Button(element)
{
	InteractiveObject.call(this, element);

	this.isStatic = true;
	this.updateLastPosition();
	this.ioType = "Button";
}

Button.prototype = tEngine.clone(InteractiveObject.prototype);
Button.prototype.parent = InteractiveObject.prototype;

Button.prototype.constructor = InteractiveObject;