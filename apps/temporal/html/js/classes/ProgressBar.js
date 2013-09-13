function ProgressBar(total, width, target)
{
	this.total = total;
	this.done = 0;
	this.progress = 0;
	this.width = width;
	this.target = target;
	this.element = undefined;
	this.progressBar = undefined;
	this.init();
}

ProgressBar.prototype.addProgress = function(val)
{
	this.done += val;
	this.progress = this.done/this.total;
	this.progressBar.style("width", this.progress*this.width+"px");
	if(this.progress >= 1)
	{
		this.destroy();
	}
}

ProgressBar.prototype.destroy = function()
{
	this.element.remove();
}

ProgressBar.prototype.init = function()
{
	this.element = d3.select(this.target).append("div").attr("class", "progressBar").style("width", this.width+"px");
	this.progressBar = this.element.append("div").attr("class", "bar").style("width", this.progress*this.width+"px");
}