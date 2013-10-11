/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true, sloppy:true */

var host = document.location.host;
// if (host.indexOf(':') >= 0) { host = host.slice(0,host.indexOf(':')); }
var channelURL = 'http://'+host+'/channel.html';
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
	WebBox.load().then(function() {
		var u = WebBox.utils;
		require(['js/saveface-app'], function(saveface) {
			var graphname = 'facebook';
			var router;
			// Additional init code here
			var path = document.location.pathname;
			var basepath = path.slice(0,path.lastIndexOf('/')); // chop off 2 /'s
			basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';
			basepath = basepath.slice(0,Math.max(0,basepath.lastIndexOf('/'))) || '/';	
			require.config({ baseUrl: basepath });
			var store = window.store = new WebBox.Store();
			store.toolbar.on('change:selected-box', function(bid) {
				if (bid !== undefined) {
					var box = store.boxes().get(bid);
					box.fetch().then(function() {
						var g = box.get_or_create('facebook');
						g.fetch().then(function() {
							router = saveface.init(g);
						}).fail(function(err, b) {
							u.error(' ERROR ', err, b);
						});
					});
				} else {
					if (router === undefined) { router.hide(); }
					router = undefined; 
				}
			});
			store.toolbar.on('logout', function() {
				if (router !== undefined) { router.hide();	}
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

