var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;

var store = indx.store;
var temporalBox = undefined;

store.login('indx', 'indx').then(function(status)
{
    // store.get_box('temporal').then(function(box) 
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

	// store.get_box('nike').then(function(box) 
	// {
	// 	temporalBox = box;
	// 	box.get_obj(box.get_obj_ids()).then(function(objs) {
	// 		FuelbandImporter.parseData(objs);
	// 	});
	// });
});