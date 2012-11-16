var host = document.location.host;
if (host.indexOf(':') >= 0) {
	host = host.slice(0,host.indexOf(':'));
}
var channelURL = '//'+host+'/channel.html';
console.log('checking for channel file at ', channelURL);
// Additional JS functions here
window.fbAsyncInit = function() {
	FB.init({
		appId	  : '296646860441717', // App ID
		channelUrl : channelURL, // Channel File
		status	 : true, // check login status
		cookie	 : true, // enable cookies to allow the server to access the session
		xfbml	  : true  // parse XFBML
	});
	// Additional init code here
	var path = document.location.pathname;
	var basepath = path.slice(0,path.lastIndexOf('/')); // chop off 2 /'s
	basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';
	basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';	
	console.log('setting baseurl to ', document.location.pathname, '-', basepath);
	require.config({ baseUrl:  basepath });
	require(['apps/saveface/js/saveface-app', 'components/toolbar/toolbar'], function(saveface, tbcomponent) {
		$.getScript('http://'+host+':8211/js/webbox-backbone.js', function() {
	  		var store = new ObjectStore.Store();
			window.store = store;
			var graphname = 'facebook';
			console.log('toolbar >> ', tbcomponent);
			var toolbar = tbcomponent.init(store);
			var router = undefined;
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
						.then(function() { get_graph(store.get(boxname));})
						.fail(function(err) { console.error('fail loading box ', err); });
				};
				store.create_box(boxname).then(load_box).fail(load_box);
				return d.promise();
			};
			toolbar.on('change:box', function(b) {
				if (b !== undefined) {
					get_graph(b).then(function(graph) {
						router = saveface.init(graph);
						router.show();
					});
				} else {
					if (router !== undefined) {	router.hide();	}
					router = undefined;
				}
			});
			toolbar.on('logout', function() {
				console.log('toolbar logout');
				if (router !== undefined) {
					router.hide();
				}
				router = undefined;
			});
		});
	});
};
// Load the SDK Asynchronously
(function(d){
	var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
	if (d.getElementById(id)) {return;}
	js = d.createElement('script'); js.id = id; js.async = true;
	js.src = "//connect.facebook.net/en_US/all.js";
	ref.parentNode.insertBefore(js, ref);
}(document));

