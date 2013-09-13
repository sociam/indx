function GraphText(text, style, x, y, anchor)
{
	this.text = text;
	this.x = x;
	this.y = y;
	this.style = style;
	if(typeof anchor === "undefined")
		this.anchor = "start";
	else
		this.anchor = anchor;
}