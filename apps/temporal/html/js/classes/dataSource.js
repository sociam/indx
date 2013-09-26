function DataSource(source, name, unit)
{
	this.readings = [];
	this.source = source;
	this.name = name;
	this.unit = unit;
}

DataSource.prototype.generateRandomData = function()
{
	var timestamp = new Date().getTime();
	var n = 10000;
	for(var i=0;i<n;i++)
	{
		var reading = [];
		reading.data = Math.random()*(20) - Math.random()*(5);
		// this.data[i] = (i/n)*10;
		reading.instant = new Date(timestamp-(n-1)*60000+(i*60000));

		this.readings.push(reading);
	}
}

