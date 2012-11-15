
var host = document.location.host;
if (host.indexOf(':') >= 0) {
	host = host.slice(0,host.indexOf(':'));
}

$(document).ready(function() {
	console.log('http://'+host+':8211/js/webbox-backbone.js');

	var test_pasta = function() {
		store.login('electronic', 'foobar').then(function(x) {
			console.log('logged in ');
			store.load_box('pastas').then(function(box) {
				console.log("got a box of pastas ", box.id, box);
				var dinnergraph = box.get_or_create('dinner');
				var carbonara = dinnergraph.get_or_create('puttanesca');
				carbonara.set({name:"carbonara", calories:10293, carbs: 92389, fats: 2398, yumminess:2398 });
				dinnergraph.save();
			});										  
		});
	};
	
	$.getScript('http://'+host+':8211/js/webbox-backbone.js', function() {
		console.log('get script done');
	  	var store = new ObjectStore.Store([], { server_url : "http://"+host+":8211/" });
		window.store = store;
		test_pasta(store);
		
		
		$('#login').click(function() {
			var username = $('#username').val(), pass = $('#password').val()
			console.log('logging in as user ', username, pass)			
			store.login(username,pass).then(function() {
				console.log('logged in ');
			}).fail(function(err) {
				console.log('fail ', err);
			});
		});

	});
});
