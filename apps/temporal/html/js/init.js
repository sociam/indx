tEngine.graphListElement = $("#left")[0];

tEngine.setTimeline($("#timeline"))

// var dataSource = new DataSource();
// var channel1 = tEngine.addChannel("Fuel Band: Calories", dataSource);
// var dataSource = new DataSource();
// var channel2 = tEngine.addChannel("Fuel Band: Steps", dataSource);
// var dataSource = new DataSource();
// var channel3 = tEngine.addChannel("Fuel Band: Fuel", dataSource);
// var dataSource = new DataSource();

// tEngine.bindGraph(channel1);
// tEngine.bindGraph(channel2);
// tEngine.bindGraph(channel3);

tEngine.bindButton(document.getElementById('debugButton'));

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

    // store.get_box('nike').then(function(box) 
    // {
    //     box.query({"@id" : {"ne": 0}}).then(function (objs){
    //         console.debug(objs)
    //     });
    // });

    store.get_box('nike').then(function(box) 
    {
        window.setTimeout(function ()
        {
            console.log("Get obj ids...")
            var objs = box.get_obj_ids();
            // console.log(objs)
            var done = 0;
            // var objs = objs.slice(10);
            var pb = new ProgressBar(objs.length, 200, "#debugMenu");
            tEngine.totalSources++;
            console.log("Building promises list...");
            var promises = [];
            for(var x in objs)
            {
                var res = box.get_obj(objs[x]);
                res.then(function() {pb.addProgress(1);});
                promises.push(res);
            }
            u.when(promises).then(function(results) 
            {
                FuelbandParser.parseData(results);
                tEngine.loadedSource();
            }).fail(function(err) 
            {
                console.error('i am so sad, there was an error fetching some dudes', err);
            });
        }, 0);
    });

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
})
