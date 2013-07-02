describe('indx-core', function() {
	var injector = angular.injector(['ng','indx']);
	var indx = injector.get('client'),
	    u = injector.get('utils'),
	    store = new indx.Store({server_host:"localhost:8211"});

	it('should be loaded', function() {
		waitsFor(function() {
			return store !== undefined;
		}, 'webbox never came about :(', 10000);
	});

	it('should log in with webbox/webbox', function() {
		var loggedin;
		store.login('webbox','webbox')
			.then(function(x) { dump('login done '); loggedin = x; })
			.fail(function(x) { console.error('fail logging in ', x); });
		waitsFor(function() { return loggedin !== undefined; });
	});

	it('getinfo', function() {
		var gi;
		runs(function() {
			store.getInfo()
				.then(function(x) { dump('getinfo ', x); gi = x; })
				.fail(function(x) { console.error('fail logging in ', x); });
		});
		waitsFor(function() { return gi; });
		runs(function() {
			expect(gi).toBeDefined();
			dump('done waiting ', gi);	
		});		
	});

	it('should fetch boxes', function() {
		var boxes;
		runs(function() {
			store.fetch()
				.then(function(x) { dump('boxes ', x); boxes = store.boxes(); })
				.fail(function(x) { console.error('fail logging in ', x); });
		});
		waitsFor(function() { return boxes; });
		runs(function() {
			dump('boxes >> ', boxes.map(function(x) { return x.get_id(); }));
		});
	});	
	
});

