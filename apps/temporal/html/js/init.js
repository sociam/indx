tEngine.graphListElement = $("#left")[0];

tEngine.setTimeline($("#timeline"))

tEngine.bindDebugButton(document.getElementById('debugButton'));

document.ontouchmove   = function(event) 
{
	event.preventDefault();
	tEngine.touchMove.call(tEngine, event);
};
document.ontouchstart  = function(event) 
{
	event.preventDefault();
	tEngine.touchMove.call(tEngine, event);
};
document.ontouchend    = function(event) 
{
	event.preventDefault();
	tEngine.touchEnd.call(tEngine, event);
};
document.ontouchcancel    = function(event) 
{
	event.preventDefault();
	tEngine.touchCancel.call(tEngine, event);
};

document.onmousedown = function(event) {tEngine.enableDrag.call(tEngine, event);};
document.onmousemove = function(event) {tEngine.mouseMove.call(tEngine, event);};
document.onmouseup   = function(event) {tEngine.disableDrag.call(tEngine, event);};

document.onkeydown = function(event) {tEngine.pressKey.call(tEngine, event);};
document.onkeyup = function(event) {tEngine.releaseKey.call(tEngine, event);};
document.onmousewheel = function(event) {tEngine.wheel.call(tEngine, event);}; 

window.onbeforeunload = function(event)   { tEngine.unload.call(tEngine, event);};
window.onresize = function(event) { tEngine.resize.call(tEngine, event);};

window.setTimeout(function() 
	{
		tEngine.processEvents()
	}
	, 1000/tEngine.framerate);

var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;

var store = indx.store;

store.login('indx', 'indx').then(function(status)
{
    // load a box
    // store.get_box('fitbit').then(function(box) 
    // {
    //     window.setTimeout(function ()
    //     {
    //         console.log("Get obj ids...");
    //         var objs = box.get_obj_ids();

    //         // console.log(objs)
    //         var done = 0;
    //         var objs = [objs[0], objs[1], objs[2], objs[3], objs[4], objs[5], objs[6]];
    //         var pb = new ProgressBar(objs.length, 200, "#debugMenu");
    //         tEngine.totalSources++;
    //         console.log("Building promises list...");
    //         var promises = objs.map(function(oid) 
    //         {
    //             // console.log(oid);
    //             res = box.get_obj(oid);
    //             res.then(function() {pb.addProgress(1);});
                
    //             return res;
    //         });
    //         u.when(promises).then(function(results) 
    //         {
    //             // omg ! i have all objects in results. i am so happy. i can't even ...

    //             // FitbitParser.parseData(results);
                
    //             var ds = new DataSource();
    //             ds.generateRandomData();
    //             tEngine.bindGraph(tEngine.addChannel("Fitbit: Calories", ds));
    //             tEngine.bindGraph(tEngine.addChannel("Fitbit: Distance", ds));
    //             tEngine.bindGraph(tEngine.addChannel("Fitbit: Steps", ds));

    //             tEngine.loadedSource();
    //         }).fail(function(err) 
    //         {
    //             console.error('i am so sad, there was an error fetching some dudes', err);
    //         });
    //     }, 0);
    // });
    // tEngine.totalSources++;
    // tEngine.totalSources++;
    // var ds = new DataSource();
    // ds.generateRandomData();
    // tEngine.bindGraph(tEngine.addChannel("Fitbit: Calories", ds));

    // var ds = new DataSource();
    // ds.generateRandomData();
    // tEngine.bindGraph(tEngine.addChannel("Fitbit: Distance", ds));

    // var ds = new DataSource();
    // ds.generateRandomData();
    // tEngine.bindGraph(tEngine.addChannel("Fitbit: Steps", ds));

    // tEngine.loadedSource(); 

    // store.get_box('nike').then(function(box) 
    // {
    //     box.query({"@id" : {"ne": 0}}).then(function (objs){
    //         console.debug(objs)
    //     });
    // });

    // store.get_box('nike').then(function(box) 
    // {
    //     window.setTimeout(function ()
    //     {
    //         console.log("Get obj ids...")
    //         // var objs = box.get_obj_ids();
    //         box.get_obj(box.get_obj_ids()).then(function(objs) {
    //             // console.log(objs);
    //             FuelbandParser.parseData(objs);
    //             tEngine.loadedSource();
    //         });
    //         // console.log(objs)
    //         // var done = 0;
    //         // var objs = objs.slice(10);
    //         // var pb = new ProgressBar(objs.length, 200, "#debugMenu");

    //         // console.log("Building promises list...");
    //         // var promises = [];
    //         // for(var x in objs)
    //         // {
    //         //     var res = box.get_obj(objs[x]);
    //         //     res.then(function() {pb.addProgress(1);});
    //         //     promises.push(res);
    //         // }
    //         // u.when(promises).then(function(results) 
    //         // {
    //             // FuelbandParser.parseData(results);
    //             // tEngine.loadedSource();
    //         // }).fail(function(err) 
    //         // {
    //         //     console.error('i am so sad, there was an error fetching some dudes', err);
    //         // });
    //     }, 0);
    // });

    ////////////////// FUEL BAND
    // store.get_box('duckies').then(function(box) 
    // {
    // 	var patt=/^(nikeplus-)/i;
    // 	var objs = box.get_obj_ids();
    // 	for(var i=0;i<objs.length;i++)
    // 	{
    // 		if(patt.test(objs[i]) == true)
    // 		{
    // 			box.get_obj(objs[i]).then(
    // 				function (log)
    // 				{
    // 					for(var j=0;j<log.attributes.metrics.length;j++)
    // 						console.log(log.attributes.metrics[j].attributes.metricType, log.attributes.metrics[j].attributes)
    // 				}
    // 				);
    // 		}
    // 		// console.log(objs[i]);
    // 	}
    // });

    // store.get_box('nike').then(function(box) 
    // {
    //     var objs = box.get_obj_ids();
    //     var promises = objs.map(function(oid) 
    //     {
    //         res = box.get_obj(oid).then(function (ds) 
    //             {
    //                 ds.destroy();
    //             });
    //     });
    // });

    store.get_box('temporal').then(function(box) 
    {
        tEngine.temporalBox = box;
        
        box.get_obj(box.get_obj_ids()).then(function (ds)
        {
            for(var i in ds)
            {
                var dataSegmentPattern = /^(data-segment-)/i;
                var dataSourcePattern  = /^(data-source-)/i;
                var annotationPattern  = /^(annotation-)/i;
                var gtimeseries  = /^(gtimeseries-)/i;
                

                if(annotationPattern.test(ds[i].id)) // annotation
                {
                    var activityLabel = ds[i].attributes.activity[0];

                    if(typeof tEngine.activityMap[activityLabel] === "undefined") // if activity doesn't exist
                    {
                        activity = new Activity(activityLabel);
                        activity.lastID += Math.abs((Math.random() * 1e10) | 0);
                        activity.setVisible(false);
                        tEngine.activityMap[activityLabel] = activity;
                        tEngine.updateActivityList();
                    }
                    else
                    {
                        activity = tEngine.activityMap[activityLabel];
                    }

                    this.annotationID = activity.addInstanceFromINDX(ds[i].attributes.begin[0], ds[i].attributes.end[0], ds[i].attributes.annot_id[0]);
                }
                else if(dataSegmentPattern.test(ds[i].id))
                {
                    // console.log(ds[i].id)
                }
                else if(dataSourcePattern.test(ds[i].id))
                {
                    var dataSource = new DataSource();
                    dataSource.loadTemporalFormat(ds[i]);
                    var channel = tEngine.addChannel(dataSource.source+": "+dataSource.name, dataSource);
                    tEngine.bindGraph(channel);
                    tEngine.loadedSource();
                }
                else if(gtimeseries.test(ds[i].id))
                {
                    var dataSource = new DataSource();
                    dataSource.loadGFormat(ds[i]);
                    var channel = tEngine.addChannel(dataSource.source+": "+dataSource.name, dataSource);
                    tEngine.bindGraph(channel);
                    tEngine.loadedSource();
                }
            }
        });




        // u.when(promises).then(function() {
        // ////////////////////////////////////////
        //     var dataValues = [];
        //     for(var i in fuelband_cal.readings)
        //     {
        //         dataValues.push(fuelband_cal.readings[i].data);
        //     }
        //     var dataSegment = 
        //     {
        //         // id: "id",
        //         start_timestamp: fuelband_cal.readings[0].instant,
        //         values: dataValues
        //     };

        //     // RANDOM DATA

        //     var fuelband_cal = new DataSource();
        //     fuelband_cal.generateRandomData();

        //     var randomID = Math.abs((Math.random() * 1e10) | 0);
        //     console.log(randomID);
        //     var identifier = "dataSegment-"+randomID+"-"+(dataSegment["start_timestamp"].valueOf());

        //     var dataSegmentList = [];
        //     box.get_obj(identifier).then(function (ds) 
        //     {
        //         dataSegmentList.push(ds);
        //         ds.set(dataSegment);
        //         ds.save().done(function() {
        //             box.get_obj('fuelband-calories').then(function (ds) 
        //                 {        
        //                 ds.set({
        //                     type: "g_dude",
        //                     name: 'Calories',
        //                     owner: undefined,
        //                     device: 'FuelBand',
        //                     source: 'Random',
        //                     unit: 'cal',
        //                     values: dataSegmentList
        //                 });
        //                 ds.save();
        //             });
        //         });
        //     });
        // /////////////////////////////////////////
        // });

        // var promises = objs.map(function(oid) 
        // {
        //     var activity;
        //     res = box.get_obj(oid).then(function (ds) 
        //         {
        //             var activityLabel = ds.attributes.activity[0];

        //             if(typeof tEngine.activityMap[activityLabel] === "undefined") // if activity doesn't exist
        //             {
        //                 activity = new Activity(activityLabel);
        //                 activity.lastID += Math.abs((Math.random() * 1e10) | 0);
        //                 activity.setVisible(false);
        //                 tEngine.activityMap[activityLabel] = activity;
        //                 tEngine.updateActivityList();
        //             }
        //             else
        //             {
        //                 activity = tEngine.activityMap[activityLabel];
        //             }

        //             this.annotationID = activity.addInstanceFromINDX(ds.attributes.begin[0], ds.attributes.end[0], ds.attributes.annot_id[0]);
        //         });
        // });
    // });



    });
});
