
var host = document.location.host;
if (host.indexOf(':') >= 0) {
	host = host.slice(0,host.indexOf(':'));
}

$(document).ready(function() {
	console.log('http://'+host+':8211/js/webbox-backbone.js');
	$.getScript('http://'+host+':8211/js/webbox-backbone.js', function() {
		console.log('get script done');
	  	var store = new ObjectStore.Store([], { server_url : "http://"+document.location.host+":8211/" });
		window.store = store;
		$('#login').click(function() {
			console.log('logging in as user ', $('#username').val())
			var username = $('#username').val(), pass = $('#password').val()
			store.login(username,password).then(function() {
				console.log('logged in ');
			}).fail(function(err) {
				console.log('fail ', err);
			});
		});

	});
});
