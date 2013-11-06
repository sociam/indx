var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;

var store = indx.store;
var temporalBox = undefined;

store.login('indx', 'indx').then(function(status)
{
    // store.getBox('temporal').then(function(box) 
    // {
    //     var objs = box.getObjIDs();
    //     var promises = objs.map(function(oid) 
    //     {
    //         res = box.getObj(oid).then(function (ds) 
    //             {
    //                 ds.destroy();
    //             });
    //     });
    // });

	// store.getBox('nike').then(function(box) 
	// {
	// 	temporalBox = box;
	// 	box.getObj(box.getObjIDs()).then(function(objs) {
	// 		FuelbandImporter.parseData(objs);
	// 	});
	// });
});