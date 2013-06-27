
/*

  angular
	.module('webbox')
	.run(function(webbox) {
		dump('injected webbox ', webbox);
	});
*/

describe('foobar', function() {
	var injector = angular.injector(['ng','webbox']);
	var webbox = injector.get('webbox');
	dump('webbox is ', webbox);
	it('should be loaded', function() {
		waitsFor(function() {
			return webbox !== undefined;
		}, 'webbox never came :(', 10000);
	});
	
	it('store is defined', function() { expect(webbox.store).toBeDefined(); });
	it('store has boxes', function() {
		var store = webbox.store, boxes;
		store.fetch().then(function() {
			log('fetched >> ');
			boxes = store.boxes();
		});
		waitsFor(function() {
			return boxes;
		}, "never finished ");
		dump('got boxes? ', boxes && boxes.length);		
	});		
});

