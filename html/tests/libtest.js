
$('#loader').width($(document).width());
WebBox.load().then(function(exports) {
	console.log('exports ', exports);
	$('#loader').fadeOut('slow', function() {
		$('.loaded').slideDown('slow');
		window.store = new WebBox.Store();
		setTimeout(function() { 
			store.login('electronic','foo').then(function() {
				console.log('ok');
			});
		}, 1000);
	});
});
