
describe('example', function () {
	beforeEach(function() {
	    browser().navigateTo('/apps/examples/angular-example.html');
	});

	it('should have real time', function() {
		expect(element('body').html()).toContain('real time')
	});
})


/*
describe('Array', function(){
  describe('#indexOf()', function(){
    it('should return -1 when the value is not present', function(){
      //assert.equal(-1, [1,2,3].indexOf(5));
      //assert.equal(-1, [1,2,3].indexOf(0));
      //expect(1).toEqual(1);

    })
  })
});

describe('WebBox-Backbone', function () {
	describe('load', function () {
		var loaded;
		it('should load the javascript dependancies', function () {
			runs(function () {
				loaded = false;
				WebBox.load().then(function () {
					console.log("JK")
					loaded = true;
				}).always(function () {
					console.log("blah")
				});
			});
			debugger;
			waitsFor(function () {
				return loaded;
			}, 'WebBox to load', 2000);
			runs(function () {
			});
		});
		describe('Store', function () {
			var store;
			beforeEach(function() {
				store = new WebBox.Store();
			});
			it('should be able to authenticate', function () {

			});
		});
	});
});
*/
