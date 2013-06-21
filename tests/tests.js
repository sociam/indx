
describe('example', function () {
	var angular;
	beforeEach(function() {
	    browser().navigateTo('/apps/examples/angular-example.html');
	    //angular = window.frames[0].window.angular; // WTF?!?
	});

	it('should be equal', function() {
		expect(value(20)).toBe(20);
	});
	it('should have real time', function() {
		//console.log(window.frames[0].document.body.innerHTML);
		angular = window.frames[0].window.angular; // WTF?!?
		//debugger;
		expect(angular.element('div').count()).toEqual(4)
		//console.log(angular.element('body').html());
		//expect(angular.element('body').html()).toContain('real time')
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

//http://zachsnow.com/#!/blog/2013/expecting-expect-work-expected/
angular.scenario.dsl('value', function() {
  return function(value) {
    return this.addFuture('value to future', function(done) {
      done(null, value);
    });
  };
});
