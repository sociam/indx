/* global describe, angular, beforeEach, it, waitsFor, dump, expect, runs, console */

(function () {
	'use strict';

	var user = 'webbox',
		pass = 'foobar',
		testboxname = 'boxtest' + (new Date()).getTime(); // FIXME can't have dash in name?

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
			waitsFor(function() { return loggedin === false; }, 'the user to not be logged in', 500);
			runs(function () { expect(loggedin).toBe(false); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store1.login(user, pass) .then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user to be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// log out, make sure yo'ure not logged in
		it('should log out', function () {
			var loggedout;
			store1.logout().then(function () { loggedout = true; });
			waitsFor(function() { return loggedout; }, 'the user to be logged out', 500);
			runs(function () { expect(loggedout).toBe(true); });
		});

		// login as you
		it('should successfully log in with valid credentials', function () {
			var loggedin;
			store1.login(user, pass).then(function () { loggedin = true; });
			waitsFor(function() { return loggedin; }, 'the user to be logged in', 500);
			runs(function () { expect(loggedin).toBe(true); });
		});

		// make sure you're logged in


		// create box
		it('should allow a box to be created', function () {
			var box;
			store1.create_box(testboxname).then(function () {
				console.log("CREATED")
				box = store1.get_box(testboxname);
			});
			waitsFor(function () { return box; }, 'the box to be created', 500);
			runs(function () { expect(box).toBeDefined(); });
		});

		it('should fail to create a box if it already exists', function () {
			var failed;
			store1.create_box(testboxname).fail(function () {
				failed = true;
			});
			waitsFor(function () { return failed; }, 'the box to not have been created', 500);
			runs(function () { expect(failed).toBe(true); });
		});

		it('should have this box within another store', function () {
			waitsFor(function () { return store2.boxes().get(testboxname); });
			runs(function () { expect(store2.boxes().get(testboxname)).toBeDefined(); });
		});

		// hack
		//testboxname = 'blah';

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
				waitsFor(function () { return s1box && s2box; }, 'the box to be fetched', 500);
				runs(function () {
					expect(s1box).toBeDefined();
					expect(s2box).toBeDefined();
				});
			});

			it('should allow an object to be created', function () {
				var obj;
				s1box.get_obj('test1').then(function(o) { obj = o; });
				waitsFor(function () { return obj; }, 'the object to be created', 500);
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
					waitsFor(function () { return s1obj; }, 'the object to be fetched', 500);
					runs(function () {
						expect(s1obj).toBeDefined();
					});
				});

				it('should allow the object to be created', function () {
					var saved;
					s1obj.save({ value: 99 }).then(function () { saved = true; });
					waitsFor(function () { return saved; }, 'the object to have changed', 500);
					runs(function () { expect(s1obj.get('value')[0]).toBe(99); });
				});
				it('should allow another store (store 2) to load the object', function () {
					s2box.get_obj('test1').then(function (o) { s2obj = o; });
					waitsFor(function () { return s2obj; }, 'the object to be fetched', 500);
					runs(function () { expect(s2obj).toBeDefined(); });
				});
				it('should be up-to-date in store 2', function () {
					waitsFor(function () { return s2obj.get('value') && s2obj.get('value')[0] === 99; },
							'the object to be up-to-date', 500);
					runs(function () { expect(s2obj.get('value')[0]).toBe(99); });
				});
				it('should not be using the same cache between stores', function () {
					expect(s1obj.attributes).not.toBe(s2obj.attributes);
				});
				it('should allow the store 2 to edit the object', function () {
					var saved;
					s2obj.save({ value: 97 }).then(function () { saved = true; });
					waitsFor(function () { return saved; }, 'the object to have changed', 500);
					runs(function () { expect(s2obj.get('value')[0]).toBe(97); });
				});
				it('should have updated the object in store 1', function () {
					waitsFor(function () { return s1obj.get('value') && s1obj.get('value')[0] === 97; },
								'the object to be up-to-date', 500);
					runs(function () { expect(s1obj.get('value')[0]).toBe(97); });
				});

				it('should not allow two conflicting objects', function () {
					var s1obj, s2obj,
						passes = 0,
						fails = 0;
					s1box.get_obj('test2').then(function (o) { s1obj = o; });
					s2box.get_obj('test2').then(function (o) { s2obj = o; });
					s1box.save().then(function () { passes++; }).fail(function () { fails++; });
					s2box.save().then(function () { passes++; }).fail(function () { fails++; });
					waitsFor(function () { return passes + fails === 2; }, 'the boxes to have changed', 500);
					runs(function () {
						expect(passes).toBe(1);
						expect(fails).not.toBe(0);
					});
				});
			});

			it('should be deletable', function () {
				var destroyed;
				s1box.destroy().then(function () { destroyed = true; });
				waitsFor(function () { return destroyed; }, 'the box to be deleted', 500);
				runs(function () { expect(s1box).not.toBeDefined(); });
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
