var host = document.location.host;
if (host.indexOf(':') >= 0) {
	host = host.slice(0,host.indexOf(':'));
}
// Additional JS functions here
$(document).ready(function() {
	var path = document.location.pathname;
	var basepath = path.slice(0,path.lastIndexOf('/')); // chop off 2 /'s
	basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';
	basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';	
	console.log('setting baseurl to ', document.location.pathname, '-', basepath);
	require.config({ baseUrl:  basepath });
	require(['apps/enriches/js/enrich-app', 'components/toolbar/toolbar'], function(enrich, tbcomponent) {
		$.getScript('http://'+host+':8211/js/webbox-backbone.js', function() {
	  		var store = new ObjectStore.Store();
			window.store = store;
			var graphname = 'enrich';
			var toolbar = tbcomponent.init(store);
			var app = undefined;
			var get_graph = function(boxname) {
				var d = new $.Deferred();
				var get_graph = function(box) {					
					var graph = box.get_or_create(graphname);
					graph.fetch().then(function(graph) {
						console.log('graph loaded ', graph.objs().length, ' items already in it');
						d.resolve(graph);
					});
				};
				var load_box = function() {
					store.load_box(boxname)
						.then(function(box) { window.box = box; get_graph(store.get(boxname));})
						.fail(function(err) { console.error('fail loading box ', err); });
				};
				store.create_box(boxname).then(load_box).fail(load_box);
				return d.promise();
			};
			toolbar.on('change:box', function(b) {
				console.log('change box ', b);
				if (b !== undefined) {					
					// enrich.set({box:b});
					get_graph(b).then(function(graph) {
						// enrich.set({graph:graph});
					});
				} 
			});
			toolbar.on('login', function() { if (app !== undefined) { app.show(); }	});			
			toolbar.on('logout', function() { if (app !== undefined) { app.hide(); }});
			app = enrich.init();
			window.app = app;
		});
	});
});
