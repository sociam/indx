/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true */

$('#loader').width($(document).width());
WebBox.load().then(function(exports) {
	console.log('exports ', exports);
	$('#loader').fadeOut('slow', function() {
		$('.loaded').slideDown('slow');
		window.store = new WebBox.Store();
		store.login('electronic','foo').then(function() {
			console.log('ok');
		});
	});
});
