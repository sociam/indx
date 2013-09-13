function FitbitParser()
{

}


FitbitParser.compareFunction = function(a, b)
{
	if(a.instant < b.instant)
		return -1;
	else if(a.instant == b.instant)
		return 0;
	else
		return 1;
}

FitbitParser.parseData = function(fbdata)
{
	var calories = new DataSource("Fitbit");
	var steps = new DataSource("Fitbit");
	var distance = new DataSource("Fitbit");

	console.log("Parsing data...");
	// console.log(fbdata)
	var patt=/^(fitbit_obs_)/i;
	
	for(var i=0;i<fbdata.length;i++)
	{
		if(patt.test(fbdata[i].id) == true)
		{
			var calo = [];
			var step = [];
			var dist = [];

			if(typeof fbdata[i].attributes.distance !== "undefined")
			{
				dist.data = fbdata[i].attributes.distance[0];
			}
			else
			{
				dist.data = 0;
			}
			if(typeof fbdata[i].attributes.step_count !== "undefined")
			{
				step.data = fbdata[i].attributes.step_count[0];
			}
			else
			{
				step.data = 0;
			}

			calo.data = fbdata[i].attributes.calories_burned[0];

			calo.instant = fbdata[i].attributes.end[0];
			step.instant = fbdata[i].attributes.end[0];
			dist.instant = fbdata[i].attributes.end[0];

			calories.readings.push(calo);
			steps.readings.push(step);
			distance.readings.push(dist);
			// console.log(fbdata[i].attributes.start[0]);
		}
	}

	console.log("Done. Sorting...");

	calories.readings.sort(FitbitParser.compareFunction);
	steps.readings.sort(FitbitParser.compareFunction);
	distance.readings.sort(FitbitParser.compareFunction);

	// this.generateRandomData();
	var calories_channel = tEngine.addChannel("Fitbit: Calories", calories);
	var steps_channel = tEngine.addChannel("Fitbit: Steps", steps);
	var distance_channel = tEngine.addChannel("Fitbit: Distance", distance);

	// tEngine.bindGraph(calories_channel);
	// tEngine.bindGraph(steps_channel);
	// tEngine.bindGraph(distance_channel);

}