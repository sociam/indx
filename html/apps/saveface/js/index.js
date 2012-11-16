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
			console.log('toolbar >> ', tbcomponent);
			var toolbar = tbcomponent.init(store);
			var boxname = 'mybox';
			var graphname = 'facebook';			
			/*
			// 
			var username = 'electronic';
			var password = 'foobar';
			//
			*/
			var init = function() {
				var d = new $.Deferred();
				var get_graph = function(box) {					
					var graph = box.get_or_create(graphname);
					graph.fetch().then(function(graph) {
						console.log('graph loaded ', graph.objs().length, ' items already in it');
						var sfi = saveface.init(graph);
						d.resolve(sfi);
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
			var sf_instance = undefined;
			store.checkLogin().then(function(result) {
				console.log('checklogin sdlkfjdsflkj ', result);
				if (result.is_authenticated) {
					console.log('autocalling initttttttttttttttttttt ------------->');					
					init().then(function(sfi) { sf_instance = sfi; });
				} else {
					store.on('login',function() {
						console.log('calling initttttttttttttttttttt ------------->');
						init().then(function(sfi) { sf_instance = sfi; });
						store.off('login',arguments.callee);
					});
				}
				store.on('logout', function() {
					if (sf_instance) {
						sf_instance.hide(); sf_instance = undefined;
					}
					store.off('logout',arguments.callee);
				});
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

