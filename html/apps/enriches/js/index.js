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
	    function populate_table(box) {
	        box.ajax('/get_all_transactions', 'GET', { 'persona': 'Persona2' })
				.then(function(results) {
				    results['data'].map(function(result) {
				        var place = '';
				        var establishment = '';
				        if(result['place_id']) {
				            place = result['place_id'];
			            }
    				    if(result['establishment_id']) {
    				        establishment = result['establishment_id'];
				        }
				        $('<tr><td>'+result['date']+'</td><td>'+result['description']+'</td><td>'+result['amount']+'</td><td>'+establishment+'</td><td>'+place+'</td></tr>').appendTo($('#tran-list table'));
			        });
				});
	    }
	    
		$.getScript('http://'+host+':8211/js/webbox-backbone.js', function() {
	  		var store = new ObjectStore.Store();
			window.store = store;
			var graphname = 'enrich';
			var toolbar = tbcomponent.init(store);
			var app = undefined;
			var get_graph = function(boxname) {
				var d = new $.Deferred();
				var _get_graph = function(box) {					
					var graph = box.get_or_create(graphname);
					graph.fetch().then(function(graph) {
						console.log('graph loaded ', graph.objs().length, ' items already in it');
						d.resolve(box,graph);
					});
				};
				var load_box = function() {
					store.load_box(boxname)
						.then(function(box) { window.box = box; _get_graph(store.get(boxname));})
						.fail(function(err) { console.error('fail loading box ', err); });
				};
				store.create_box(boxname).then(load_box).fail(load_box);
				return d.promise();
			};
			var init_app = true;
			toolbar.on('change:box', function(b) {
				console.log('change box ', b);
				if (b !== undefined) {					
					// enrich.set({box:b});
					get_graph(b).then(function(box,graph) {
						if (app === undefined && init_app) {
							console.log("LOADING with BOX ", box.id);
    						app = enrich.init(box);
						} else {
						    populate_table(box);
						}
						// enrich.set({graph:graph});
					});
				} 
			});
			toolbar.on('login', function() { if (app !== undefined) { app.show(); }	});			
			toolbar.on('logout', function() { if (app !== undefined) { app.hide(); }});
			// app = enrich.init();
			
			if(document.location.hash == '#list') {
			    init_app = false;
			    $('.round-holder, .save').hide();
			    $('<div id="tran-list"></div>').appendTo('body');
			    $('#tran-list').append('<table></table>');
			    
			}
			
			window.app = app;
		});
	});
});
