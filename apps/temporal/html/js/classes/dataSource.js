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
		reading.instant = new Date(timestamp-(n-1)*60000+(i*60000));

		this.readings.push(reading);
	}
}

DataSource.prototype.loadTemporalFormat = function(ds)
{
	if(typeof ds.attributes.source !== "undefined")
		this.source = ds.attributes.source[0];
	if(typeof ds.attributes.name !== "undefined")
		this.name = ds.attributes.name[0];
	if(typeof ds.attributes.unit !== "undefined")
		this.unit = ds.attributes.unit[0];

	var begin = Number(ds.attributes.values[0].attributes.begin);
	var delta = Number(ds.attributes.values[0].attributes.delta);

	// var zeroValue = [];
	// zeroValue.data = 0;
	// zeroValue.instant = begin-1;
	// this.readings.push(zeroValue);

	for(var i in ds.attributes.values[0].attributes.values)
	{
		var aux = [];
		aux.data = ds.attributes.values[0].attributes.values[i];
		aux.instant = begin+i*delta;
		this.readings.push(aux);
	}

	// var zeroValue = [];
	// zeroValue.data = 0;
	// zeroValue.instant = this.readings[this.readings.length-1].instant+1;
	// this.readings.push(zeroValue);

}

DataSource.prototype.loadGFormat = function(ds)
{
	// console.log(ds)
	if(typeof ds.attributes.source !== "undefined")
		this.source = ds.attributes.source[0];
	if(typeof ds.attributes.channel !== "undefined")
		this.name = ds.attributes.channel[0];
	if(typeof ds.attributes.units !== "undefined")
		this.unit = ds.attributes.units;

	var lastInstant = undefined;

	for(var index in ds.attributes.segments)
	{
		// console.log(ds.attributes.segments[index].attributes);
		var begin = Number(ds.attributes.segments[index].attributes.start[0]);
		var delta = Number(ds.attributes.segments[index].attributes.delta[0]);

		if(lastInstant == undefined)
			lastInstant = begin;

		if(begin - lastInstant > 900000) 
		{
			var zeroValue = [];
			zeroValue.data = 0;
			zeroValue.instant = lastInstant+1;
			this.readings.push(zeroValue);
			lastInstant = begin;
		}

		for(var i in ds.attributes.segments[index].attributes.values)
		{
			var aux = [];
			aux.data = ds.attributes.segments[index].attributes.values[i];
			aux.instant = begin+i*delta;
			this.readings.push(aux);
			lastInstant = aux.instant;
		}
	}
}

DataSource.prototype.importTemporalFormat = function()
{
	var dsPointer = this;
	store.get_box('temporal').then(function(box) 
    {
    	var segmentList = [];
    	var instant = new Date();

    	box.get_obj("data-segment-"+dsPointer.source+"-"+dsPointer.name+"-"+Number(dsPointer.readings[0].instant)).then(function (ds) 
		{
			segmentList.push(ds);

			var valueList = [];

			for(var i in dsPointer.readings)
			{
				valueList.push(dsPointer.readings[i].data);
			}

			ds.set({
				begin: Number(dsPointer.readings[0].instant),
				delta: 60000,
				values: valueList
			});

			ds.save().done(function() {
				box.get_obj("data-source-"+dsPointer.source+"-"+dsPointer.name+"-"+Number(instant)).then(function (ds) 
				{
					ds.set({
						name: dsPointer.name,
						source: dsPointer.source,
						unit: dsPointer.unit,
						values: segmentList
					});
					ds.save();
				});
			});

		});
		// console.log(dsPointer.readings)
	});
}
