var user = 'webbox',
	pass = 'webbox';

describe('indx-core', function() {
	var injector = angular.injector(['ng','indx']), loggedin;
	var indx = injector.get('client'),
	    u = injector.get('utils'),
	    store = new indx.Store({server_host:"localhost:8211"}),
	    box;

	beforeEach(function() {
		var box_name = 'box-'+u.guid(12);
		box = undefined;
		store.login(user, pass)
			.then(function(x) {
				dump('login done ');
				loggedin = true;
				store.create_box(box_name).then(function(b) {
					box = store.get_box(box_name);
				});

			}).fail(function(x) {
				console.error('fail logging in ', x); loggedin = false;
			});
		waitsFor(function() { return loggedin === false || loggedin && box; });
	});

	it('box should be defined', function() {
		dump('box is', box);
		expect(box).toBeDefined();
	});

	// create box
	// making it sure it exists
	// login as you, make sure you're logged in
	// log out, make sure yo'ure not logged in
	// create new object that didnt exist before, check to make sure it got created
	// ?? create new object that existed before, check to see if error // updates object
	// update object, make sure it propagate
	// coordinated testing: Can we ever do this??
	//   write an object, waitFor the thing to propagate to the other client
	// delete object, make sure it's dead, jim

	// it('getinfo', function() {
	// 	var gi;
	// 	runs(function() {
	// 		store.getInfo()
	// 			.then(function(x) { dump('getinfo ', x); gi = x; })
	// 			.fail(function(x) { console.error('fail logging in ', x); });
	// 	});
	// 	waitsFor(function() { return gi; });
	// 	runs(function() {
	// 		expect(gi).toBeDefined();
	// 		dump('done waiting ', gi);
	// 	});
	// });
	// it('should fetch boxes', function() {
	// 	var boxes;
	// 	runs(function() {
	// 		store.fetch()
	// 			.then(function(x) { dump('boxes ', x); boxes = store.boxes(); })
	// 			.fail(function(x) { console.error('fail logging in ', x); });
	// 	});
	// 	waitsFor(function() { return boxes; });
	// 	runs(function() {
	// 		dump('boxes >> ', boxes.map(function(x) { return x.get_id(); }));
	// 	});
	// });

});

