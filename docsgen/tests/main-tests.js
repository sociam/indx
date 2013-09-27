var jf = jasmine.getFixtures();
jf.fixturesPath = '/base';
jf.load('html/index.html');

describe('the test documentation', function () {
  describe('the title', function () {
    var $title = $('.mainbody > h1');
    it('should appear once', function () {
      expect($title.length).toBe(1);
    });
    it('should be Tests 0.01', function () {
      expect($title.html()).toBe('Tests 0.01');
    });
  });
});