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
			store1 = new indx.Store({ server_host: 'localhost:8211' }),
			store2 = new indx.Store({ server_host: 'localhost:8211' });

		it('should fail to log in with invalid credentials', function () {
			var loggedin;
			store1.login(user, pass + 'aaa') // invalidate the password
				.fail(function () { loggedin = false; });
			waitsFor(function() { return loggedin === false; }, 'the user should not be logged in', 500);
			runs(function () { expect(loggedin).toBe(false); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store1.login(user, pass) .then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user should be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// log out, make sure yo'ure not logged in
		it('should log out', function () {
			var loggedout;
			store1.logout().then(function () { loggedout = true; });
			waitsFor(function() { return loggedout; }, 'the user should be logged out', 500);
			runs(function () { expect(loggedout).toBe(true); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store1.login(user, pass).then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user should be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// make sure you're logged in


		// create box
		it('should allow a box to be created', function () {
			var box;
			store1.create_box(testboxname).then(function () {
				box = store1.get_box(testboxname);
			});
			waitsFor(function () { return box; }, 'the box should be created', 500);
			runs(function () { expect(box).toBeDefined(); });
		});

		// hack
		testboxname = 'blah';

		describe('box', function () {
			var s1box, s2box;
			it('should be defined', function () {
				var b = store1.get_box(testboxname);
				expect(b).toBeDefined();
			});
			// making it sure it exists
			it('should be retreivable', function () {
				store1.get_box(testboxname).then(function (b) { s1box = b; });
				store2.get_box(testboxname).then(function (b) { s2box = b; });
				waitsFor(function () { return s1box && s2box; }, 'the box should be fetched', 500);
				runs(function () {
					expect(s1box).toBeDefined();
					expect(s2box).toBeDefined();
				});
			});

			it('should allow an object to be created', function () {
				var obj;
				s1box.get_obj('test1').then(function(o) { obj = o; });
				waitsFor(function () { return obj; });
				runs(function () { expect(obj).toBeDefined(); });
			});

			/*it('should not allow an object to be created if it already exists', function () {
				var obj;
				s1box.get_obj('test1').then(function(o) { obj = o; });
				waitsFor(function () { return obj; });
				runs(function () { expect(obj).toBeDefined(); });
			});*/


			describe('object', function () {
				var s1obj, s2obj;
				it('should allow the object to be fetched', function () {
					s1box.get_obj('test1').then(function (o) { s1obj = o; });
					s2box.get_obj('test1').then(function (o) { s2obj = o; });
					waitsFor(function () { return s1obj && s2obj; });
					runs(function () {
						expect(s1obj).toBeDefined();
						expect(s2obj).toBeDefined();
					});
				});

				it('should allow the object to be changed', function () {
					var saved;
					s1obj.save({ value: 99 }).then(function () { saved = true; });
					waitsFor(function () { return saved; });
					runs(function () { expect(s1obj.get('value')[0]).toBe(99); });
				});
				it('should have be up-to-date in the other store', function () {
					expect(s2obj.get('value')[0]).toBe(99);
				});
				it('should not be using the same cache between stores', function () {
					expect(s1obj.attributes).not.toBe(s2obj.attributes);
				});
			});
		});


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
