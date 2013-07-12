/* global describe, angular, beforeEach, it, waitsFor, dump, expect, runs, console */

(function () {
	'use strict';

	var user = 'webbox',
		pass = 'foobar',
		testboxname = 'box-test' + (new Date()).getTime();

	console.log('**** RUNNING TESTS (u: ' + user + ', p: ' + pass + ') ****');

	describe('indx-core', function() {
		var injector = angular.injector(['ng', 'indx']),
			indx = injector.get('client'),
			u = injector.get('utils'),
			store = new indx.Store({ server_host: 'localhost:8211' }),
			box;



		it('should fail to log in with invalid credentials', function () {
			var loggedin;
			store.login(user, pass + 'aaa') // invalidate the password
				.fail(function (x) { loggedin = false; });
			waitsFor(function() { return loggedin === false; }, 'the user should not be logged in', 500);
			runs(function () { expect(loggedin).toBe(false); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store.login(user, pass) .then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user should be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// log out, make sure yo'ure not logged in
		it('should log out', function () {
			var loggedout;
			store.logout().then(function () { loggedout = true; });
			waitsFor(function() { return loggedout; }, 'the user should be logged out', 500);
			runs(function () { expect(loggedout).toBe(true); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store.login(user, pass).then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user should be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// make sure you're logged in


		// create box
		it('should allow a box to be created', function () {
			store.create_box(testboxname).then(function () {
				box = store.get_box(testboxname);
			});
			waitsFor(function () { return box; }, 'the box should be created', 1500);
			runs(function () {
				expect(box).toBeDefined();
			});
		});


		describe('box', function () {
			it('should be retreivable', function () {
				box = store.get_box(testboxname);
				expect(box).toBeDefined();
			})
			// making it sure it exists
			it('should be defined', function() {
				dump('box is', box);
				expect(box).toBeDefined();
			});
		})


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

}());
