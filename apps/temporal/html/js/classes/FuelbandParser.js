function FuelbandParser()
{

}


FuelbandParser.compareFunction = function(a, b)
{
	if(a.instant < b.instant)
		return -1;
	else if(a.instant == b.instant)
		return 0;
	else
		return 1;
}

FuelbandParser.parseData = function(fbdata)
{
	var calories_ds = new DataSource("FuelBand");
	var steps_ds = new DataSource("FuelBand");
	// var distance_ds = new DataSource();
	var fuel_ds = new DataSource("FuelBand");

	console.log("Parsing data...");
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
			// console.log(fbdata[i]);
			var startTime = TimeUtils.parseISO8601(fbdata[i].attributes.startTime[0]);
			// console.log(startTime, fbdata[i].attributes.startTime[0]);

			for(var j=0;j<fbdata[i].attributes.metrics[0].attributes.values.length;j++)
			{
				var fuel = [];
				fuel.data = fbdata[i].attributes.metrics[0].attributes.values[j];
				fuel.instant = new Date(+(startTime) + 60000*j);
				fuel_ds.readings.push(fuel);
			}

			for(var j=0;j<fbdata[i].attributes.metrics[1].attributes.values.length;j++)
			{
				var calo = [];
				calo.data = fbdata[i].attributes.metrics[1].attributes.values[j];
				calo.instant = new Date(+(startTime) + 60000*j);
				calories_ds.readings.push(calo);
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

	console.log("Done. Sorting...");

	calories_ds.readings.sort(FuelbandParser.compareFunction);
	steps_ds.readings.sort(FuelbandParser.compareFunction);
	fuel_ds.readings.sort(FuelbandParser.compareFunction);

	// // this.generateRandomData();
	var calories_channel = tEngine.addChannel("FuelBand: Calories", calories_ds);
	var steps_channel = tEngine.addChannel("FuelBand: Steps", steps_ds);
	var fuel_channel = tEngine.addChannel("FuelBand: Fuel", fuel_ds);

	tEngine.bindGraph(calories_channel);
	tEngine.bindGraph(steps_channel);
	tEngine.bindGraph(fuel_channel);

}