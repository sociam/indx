function FuelbandImporter()
{

}


FuelbandImporter.compareFunction = function(a, b)
{
	if(a.instant < b.instant)
		return -1;
	else if(a.instant == b.instant)
		return 0;
	else
		return 1;
}

FuelbandImporter.parseData = function(fbdata)
{
	var calories_ds = new DataSource("FuelBand", "Calories");
	var steps_ds = new DataSource("FuelBand", "Steps");
	var fuel_ds = new DataSource("FuelBand", "Fuel");

	// console.log(fbdata);
	var patt=/^(nikeplus-)/i;

	for(var i=0;i<fbdata.length;i++)
	{
		if(patt.test(fbdata[i].id) == true)
		{
			if(typeof fbdata[i].attributes.metrics[0].attributes.values === "undefined") 
			{
				console.log(box);
			}
			var startTime = TimeUtils.parseISO8601(fbdata[i].attributes.startTime[0]);

			for(var j=0;j<fbdata[i].attributes.metrics[0].attributes.values.length;j++)
			{
				var fuel = [];
				fuel.data = fbdata[i].attributes.metrics[0].attributes.values[j];
				fuel.instant = new Date(+(startTime) + 60000*j);
				fuel_ds.readings.push(fuel);
			}

			for(var j=0;j<fbdata[i].attributes.metrics[1].attributes.values.length;j++)
			{
				var calories = [];
				calories.data = fbdata[i].attributes.metrics[1].attributes.values[j];
				calories.instant = new Date(+(startTime) + 60000*j);
				calories_ds.readings.push(calories);
			}

			for(var j=0;j<fbdata[i].attributes.metrics[2].attributes.values.length;j++)
			{
				var step = [];
				step.data = fbdata[i].attributes.metrics[2].attributes.values[j];
				step.instant = new Date(+(startTime) + 60000*j);
				steps_ds.readings.push(step);
			}
		}
	}

	calories_ds.readings.sort(FuelbandImporter.compareFunction);
	steps_ds.readings.sort(FuelbandImporter.compareFunction);
	fuel_ds.readings.sort(FuelbandImporter.compareFunction);

	calories_ds.importTemporalFormat();
	steps_ds.importTemporalFormat();
	fuel_ds.importTemporalFormat();
	
}