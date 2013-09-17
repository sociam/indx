function Activity(title)
{
	// var elemnt = this.appendTemplate(target);
	this.title = title;
	this.lastID = 0;
	this.instances = {};
	this.color = tEngine.pickColor();
	this.visible = true;
	this.showingInfo = false;

	this.totalDuration = 0;
	this.avgDuration = 0;

	this.totalMap = {};
	this.avgMap = {};
	this.maxMap = {};

	this.infoDiv = undefined;

// total of each data source
// average of each data source
// maximum of each data source
}

Activity.prototype.calculate = function()
{
	var annotation = [];
	this.totalDuration = 0;
	this.avgDuration = 0;

	for(var id in this.instances)
	{
		annotation.push(tEngine.getInstancesForAnnotationID(id));
	}
	for(var x in annotation)
	{
		for(var source in annotation[x])
		{
			this.totalMap[source] = 0;
			this.avgMap[source] = 0;
			this.maxMap[source] = -999999999;
		}
		break;
	}
	for(var x in annotation)
	{
		this.totalDuration += annotation[x][source].timeInterval.duration;
		this.avgDuration += annotation[x][source].timeInterval.duration/(annotation.length);
		
		var sourceCopy;
		for(var source in annotation[x])
		{
			sourceCopy = source;
			this.totalMap[source] += annotation[x][source].timeInterval.sum;

			if(annotation[x][source].timeInterval.sum > this.maxMap[source])
				this.maxMap[source] = annotation[x][source].timeInterval.sum;
			this.avgMap[sourceCopy] += annotation[x][source].timeInterval.sum/(annotation.length);
		}
	}
	console.log(this);
}

Activity.prototype.switchVisible = function()
{
	console.log("switchVisible")
	if(this.visible == true)
	{
		this.visible = false;
		for(var id in this.instances)
		{
			tEngine.removeAnnotationFromGraphs(id);
		}
	}
	else
	{
		this.visible = true;
		for(var id in this.instances)
		{
			tEngine.addAnnotationToGraphs(id, this, undefined);
		}
	}
}

Activity.prototype.addInstancesToGraph = function(graph)
{
	if(this.visible == true)
	{
		for(var id in this.instances)
		{
			tEngine.addAnnotationToGraph(id, this, graph);
		}
	}
}

Activity.prototype.addInstance = function(begin, end, origin)
{
	var id = this.title+this.lastID++;

	var instance = [];
	instance.begin = begin;
	instance.end = end;
	this.instances[id] = instance;

	if(this.showingInfo == true)
	{
		var content = this.infoDiv.select(".info");
		$(content[0]).slideUp(300, function() { content.remove(); });
		this.showingInfo = false;	
	}

	if(this.visible == false)
	{
		for(var x in this.instances)
		{
			tEngine.removeAnnotationFromGraphs(x);
		}
		
		this.visible = true;

		for(var x in this.instances)
		{
			if(id != x)
			{
				tEngine.addAnnotationToGraphs(x, this, undefined);
			}
			else
			{
				tEngine.addAnnotationToGraphs(x, this, origin);
			}
		}
	}
	else
		tEngine.addAnnotationToGraphs(id, this, origin);

	tEngine.updateActivityList();

	return id;
}

Activity.prototype.switchInfo = function(div)
{
	if(this.showingInfo == false)
	{
		this.calculate();
		this.infoDiv = div;
		var htmlContent = "<table width='100%'>";
		htmlContent += "<tr><td class='sourceName'>Total duration:</td><td>"+TimeUtils.toIntervalString(this.totalDuration)+"</td></tr>";
		htmlContent += "<tr><td class='sourceName'>Avg. Duration:</td><td>"+TimeUtils.toIntervalString(this.avgDuration)+"</td></tr>";
		htmlContent += "<tr><td colspan='2'>Total (all instances):</td>";
		for(var source in this.totalMap)
		{
			htmlContent += "<tr><td class='sourceName'>"+source+"</td><td>"+Number(this.totalMap[source]).toFixed(2)+"</td></tr>";
		}
		htmlContent += "</tr>";
		htmlContent += "<tr><td colspan='2'>Average (all instances):</td>";
		for(var source in this.avgMap)
		{
			htmlContent += "<tr><td class='sourceName'>"+source+"</td><td>"+Number(this.avgMap[source]).toFixed(2)+"</td></tr>";
		}
		htmlContent += "</tr>";
		htmlContent += "<tr><td colspan='2'>Max. Value (all instances):</td>";
		for(var source in this.maxMap)
		{
			htmlContent += "<tr><td class='sourceName'>"+source+"</td><td>"+Number(this.maxMap[source]).toFixed(2)+"</td></tr>";
		}
		htmlContent += "</tr>";


		htmlContent += "</table>";

			// <tr>\
			// 			<td></td>\
			// 		</tr>\
			// 	</table>\
			// 	"

		this.showingInfo = true;
		var content = div.append("div");

		content.attr("class", "info")
			.html(htmlContent);
		$(content[0]).hide().slideDown(300);
	}
	else
	{
		this.infoDiv = div;
		var content = div.select(".info");
		$(content[0]).slideUp(300, function() { content.remove(); });
		this.showingInfo = false;	
	}
}

Activity.prototype.removeInstance = function(id, origin)
{
	tEngine.removeAnnotationFromGraphs(id, origin);
	
	delete this.instances[id];

	var n = 0;
	for(var x in this.instances) { n++ };
	if(n == 0)
	{
		tEngine.removeActivity(this);
		tEngine.updateActivityList();
	}
}

Activity.prototype.instancesForInterval = function(begin, end)
{
	var ret = [];
	for(var x in this.instances)
	{
		if(Number(this.instances[x].end) > Number(begin) && Number(this.instances[x].begin) < Number(end))
		{
			ret.push(this.instances[x]);
		}
	}
	return ret;
}



// clipping

