/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true */

$('#loader').width($(document).width());
WebBox.load().then(function(exports) {
	$('#loader').fadeOut('slow', function() {
		$('.loaded').slideDown('slow');
		window.store = new WebBox.Store();
		store.login('electronic','foo').then(function() {
			console.log('ok');
			store.toolbar.on('change:selected-box', function(b) {
				console.log('changed ----------------- ', b, store.boxes().get(b));
				var box = store.boxes().get(b);
				box.fetch().then(function(box) {
					console.log('loaded --- ', box);
				});
			});
		});			
	});
});
