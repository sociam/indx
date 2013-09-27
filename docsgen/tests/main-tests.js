var jf = jasmine.getFixtures();
jf.fixturesPath = '/base';
jf.load('html/index.html');

describe('the documentation data model', function () {
  var file = data.files[1];

  describe('the project', function () {

  });
  describe('the file', function () {
    it('should have a description', function () {
      expect(file.description).toContain('If the tests succeed');
    });
    it('should have converted description from markdown to html', function () {
      expect(file.description).toContain('<p>');
    })
    it('should have two authors', function () {
      expect(file.author.length).toBe(2);
    });
    it('should have two authors with names', function () {
      expect(file.author[0].name).toBeDefined()
      expect(file.author[1].name).toBeDefined()
    })
    it('should have first author with an email address', function () {
      expect(file.author[0].email).toBeDefined()
      expect(file.author[1].email).toBeUndefined()
    });
    it('should have two references (@see)', function () {
      expect(file.sees.length).toBe(2);
    })
    it('should have two references that are strings', function () {
      expect(file.sees[0]).toEqual(String);
      expect(file.sees[1]).toEqual(String);
    })
    it('should have a date that this has been relevant since', function () {
      expect(file.since).toBeDefined();
      expect(file.since).toEqual(String);
    })
    it('should have a title', function () {
      expect(file.title).toBeDefined();
      expect(file.title).toEqual(String);
    })
    it('should have a version', function () {
      expect(file.version).toBeDefined();
      expect(file.version).toEqual(String);
    })
  });
  describe('the Farm class', function () {
    it('should have two methods', function () {

    });
    describe('the sell method', function () {

    });
    describe('the addField method', function () {

    })
  });
  describe('the Field class', function () {
    describe('the drawCropCircle method', function () {

    })
  })
})

describe('the documentation html', function () {
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