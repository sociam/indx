function TimeInterval()
{
	this.begin = undefined;
	this.end = undefined;

	this.indexBegin = undefined;
	this.indexEnd = undefined;

	this.dataInterval = [];
	this.interval = 0;

	this.iType = "TimeInterval";
	this.dataSource = undefined;

	this.max = 0;
	this.avg = 0;
	this.sum = 0;
	this.duration = 0;
}

TimeInterval.prototype.loadIntervals = function()
{
	this.begin = this.dataSource.readings[this.indexBegin].instant;
	this.end = this.dataSource.readings[this.indexEnd].instant;
}

TimeInterval.prototype.indexForInstant = function(instant) // can be improved
{
	for(var i=0;i<this.dataSource.readings.length;i++)
	{
		if(+(this.dataSource.readings[i].instant) >= +(instant))
		{
			return i;
		}
	}
}

TimeInterval.prototype.getIndexBegin = function()
{
	return this.dataInterval[0].originalIndex;
}

TimeInterval.prototype.getIndexEnd = function()
{
	return this.dataInterval[this.dataInterval.length-1].originalIndex;
}

TimeInterval.prototype.xForIndex = function(index, size)
{
	index = parseInt(index);
	var x = d3.time.scale().domain([this.begin, this.end]).range([0, size]);

	var pos = x(this.dataSource.readings[index].instant);
	return parseInt(pos);
}

TimeInterval.prototype.indexForX = function(x, size)
{
	var invX = d3.time.scale().domain([0, size]).range([+(this.begin), +(this.end)]);
	var instantX = invX(x);

	for(var i=this.dataInterval[0].originalIndex;i<this.dataSource.readings.length;i++)
	{
		if(i > 0)
		{
			var delta = (this.dataSource.readings[i].instant-this.dataSource.readings[i-1].instant)/2;
			if(+(instantX) <= +(this.dataSource.readings[i].instant) + delta)
			{
				break;
			}
		}
		else if(+(instantX) <= +(this.dataSource.readings[i].instant))
		{
			break;
		}
	}
	return i;
}

TimeInterval.prototype.refreshData = function()
{
	this.max = -999999999;
	this.avg = 0;
	this.sum = 0;
	this.duration = 0;

	var indexBegin = this.dataInterval[0].originalIndex;
	var indexEnd   = this.dataInterval[this.dataInterval.length-1].originalIndex;

	var n = 0;
	for(var i=indexBegin;i<indexEnd;i++)
	{
 		this.dataInterval[n].data = this.dataSource.readings[i].data;
 		if(this.dataInterval[n].data > this.max)
 			this.max = this.dataInterval[n].data;
 		this.sum += Number(this.dataInterval[n].data);
 		n++;
	}
	this.avg = Number(this.sum)/n;
	this.duration = Number(this.dataInterval[this.dataInterval.length-1].instant) - Number(this.dataInterval[0].instant);
}



TimeInterval.prototype.updateInterval = function()
{
	this.interval = (this.end.valueOf()-this.begin.valueOf())/1000;
}

TimeInterval.prototype.pan = function(pan) 
{

	var begin = new Date(this.begin.valueOf()+pan);
	var end = new Date(this.end.valueOf()+pan);

	var beginLimit = new Date(this.dataSource.readings[0].instant);
	var endLimit = new Date(this.dataSource.readings[this.dataSource.readings.length-1].instant);
	// console.log(this.dataSource.readings);

for(var i =0; i<this.dataSource.readings.length; i++)
{
	// console.log(this.dataSource.readings[i].instant);
}

	if(+(begin) >= +(beginLimit) && +(end) <= +(endLimit))
	{
		this.begin = begin;
		this.end   = end;
	}
	else if(+(begin) < +(beginLimit))
	{
		var delta = begin-beginLimit;
		this.begin = beginLimit;
		this.end   = end-delta;
	}
	else if(+(end) > +(endLimit))
	{
		var delta = end-endLimit;
		this.begin = begin-delta;
		this.end = endLimit;
	}

	this.adjustInterval();
}


TimeInterval.prototype.pinch = function(distance) 
{
	var begin = new Date(this.begin.valueOf()-distance);
	var end = new Date(this.end.valueOf()+distance);

	if(begin > end)
	{
		return;
	}

	var beginLimit = this.dataSource.readings[0].instant;
	var endLimit = this.dataSource.readings[this.dataSource.readings.length-1].instant;

	if(+(begin) > +(beginLimit))
	{
		this.begin = begin;
		
	}
	else
	{
		this.begin = beginLimit;
	}

	if(+(end) < +(endLimit))
	{
		this.end   = end;
	}
	else
	{
		this.eng = endLimit;
	}

	this.adjustInterval();
}

TimeInterval.prototype.adjustInterval = function()
{
	var indexBegin = this.dataInterval[0].originalIndex;
	var indexEnd   = this.dataInterval[this.dataInterval.length-1].originalIndex;

	var temp = [];
	var tempList = [];

	if(this.dataInterval.length == 0)
	{
		this.buildDataInterval();
	}
	else
	{
		// data before
		if(+(this.begin) < +(this.dataInterval[0].instant)) // if begin moved to the past
		{
			var i = this.dataInterval[0].originalIndex;
			if(i>0)
			{
				for(;i >= 0;i--) // get the starting point for the data
				{
					if(+(this.begin) > +(this.dataSource.readings[i].instant))
					{

						break;
					}
				}
				for(;i < this.dataInterval[0].originalIndex;i++) // add new data to temp lists
				{
					// if(+(this.dataSource.instant[i]) >= +(this.begin))
					if(i>=0)
					{
						var temp = [];
						temp.data = this.dataSource.readings[i].data;
						temp.instant = this.dataSource.readings[i].instant;
						temp.originalIndex = i;
						tempList.push(temp);
					}
				}
				this.dataInterval = tempList.concat(this.dataInterval); // add data to the beginning
			}

			// delete data from the end

			i = this.dataInterval.length-1;
			var cnt = 0;
			for(;i>0;i--)
			{
				cnt++;
				if(+(this.end) > +(this.dataInterval[i].instant))
				{
					break;
				}
			}
			i+=2;
			this.dataInterval.splice(i,cnt);
		}
		else if(+(this.begin) > +(this.dataInterval[1].instant))
		{
			for(var i=0;i<this.dataInterval.length;i++)
			{
				// console.log(+(this.begin), +(this.dataSource.readings[i].instant))
				if(+(this.begin) <= +(this.dataInterval[i].instant))
				{
					break;
				}
			}
			i--;
			this.dataInterval.splice(0,i);
		}
		if(+(this.end) >= +(this.dataInterval[this.dataInterval.length-1].instant)) // if end moved to the future (add to the end)
		{
			var i = this.dataInterval[this.dataInterval.length-1].originalIndex;
			for(;i < this.dataSource.readings.length; i++)
			{
				if(+(this.dataSource.readings[i].instant) <= +(this.end))
				{
					if(+(this.dataSource.readings[i].instant) != +(this.dataInterval[this.dataInterval.length-1].instant))
					{
						var temp = [];
						temp.data = this.dataSource.readings[i].data;
						temp.instant = this.dataSource.readings[i].instant;
						temp.originalIndex = i;

						this.dataInterval.push(temp);
					}
				}
				else
				{
					var temp = [];
					temp.data = this.dataSource.readings[i].data;
					temp.instant = this.dataSource.readings[i].instant;
					temp.originalIndex = i;
					
					this.dataInterval.push(temp);
					break;
				}
			}
		}
	}
	var indexBegin = this.dataInterval[0].originalIndex;
	var indexEnd   = this.dataInterval[this.dataInterval.length-1].originalIndex;

	this.updateInterval();
}

TimeInterval.prototype.buildDataInterval = function()
{
	this.max = -999999999;
	this.avg = 0;
	this.sum = 0;
	this.duration = 0;

	this.dataInterval = [];
	for(var i=0;i < this.dataSource.readings.length;i++)
	{
		if(+(this.dataSource.readings[i].instant) >= +(this.begin) && +(this.dataSource.readings[i].instant) <= +(this.end))
		{
			var reading = [];

			reading.data = this.dataSource.readings[i].data;
			reading.instant = this.dataSource.readings[i].instant;
			reading.originalIndex = i;

			this.sum += Number(reading.data);
			if(reading.data > this.max)
				this.max = reading.data;


			this.dataInterval.push(reading);
		}
		else if(+(this.dataSource.readings[i].instant) > +(this.end))
		{
			break;
		}
	}
	this.avg = Number(this.sum)/(this.dataInterval.length);
	this.duration = Number(this.dataInterval[this.dataInterval.length-1].instant) - Number(this.dataInterval[0].instant);
}