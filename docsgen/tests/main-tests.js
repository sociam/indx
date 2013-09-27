var jf = jasmine.getFixtures();
jf.fixturesPath = '/base';
jf.load('html/index.html');


// Add ifDefined to jasmine
var oldExpect = jasmine.Spec.prototype.expect;
jasmine.Spec.prototype.expect = function (actual) {
  var expect = oldExpect.call(this, actual);
  expect.ifDefined = jQuery.extend({}, expect);

  var keys = [];
  for (var k in expect) {
    if (typeof expect[k] === 'function') {
      keys.push(k);
    }
  }

  keys.forEach(function (key) {
    expect.ifDefined[key] = function () {
      if (actual === null || typeof actual === 'undefined') {
        return expect.toBeUndefined.apply(this);
      } else {
        return expect[key].apply(this, arguments);
      }
    };
  });
  return expect;
};

var describeEach = function (thingName) {
  var DescribeEach = function () {
    this.id = function (o) { return String(o); }
  };
  DescribeEach.prototype.withIdenfier = function (fn) {
    this.id = fn;
    if (typeof fn === "string") {
      this.id = function (o) { return o[fn]; };
    }
    return this;
  };
  DescribeEach.prototype.inArray = function (array, fn) {
    var that = this;
    if (array) {
      array.forEach(function (element, i) {
        return describe(thingName + ' ' + that.id(element, i), function () {
          fn(element, i)
        });
      });
    }
    return this;
  };
  return new DescribeEach();
};

describe('the documentation', function () {
  beforeEach(function () {
    this.addMatchers({
      toBeString: function () {
        return typeof this.actual === 'string';
      },
      toBeNumber: function () {
        return typeof this.actual === 'number';
      },
      toBeArray: function () {
        return this.actual instanceof Array;
      },
      toBeObject: function () {
        return this.actual instanceof Object &&
          !(this.actual instanceof Array);
      },
      toAtMostHaveProperties: function () {
        var pass = true;
        if (typeof this.actual !== 'Object') {
          return false;
        }
        this.actual.keys().forEach(key, function (key) {
          pass = pass & arguments.indexOf(key) > -1;
        });
        return pass;
      }
    });
  });

  describe('ifDefined', function () {
    it('works', function () {
      expect(1).ifDefined.toBe(1);
      expect(1).toBe(1);
      expect("k").ifDefined.toBeString();
    })
  })

  describeEach('number').inArray([1, 2, 3], function (n) {
    it('is a number', function () {
      expect(n).toBeNumber();
    });
  })


  describe('data model:', function () {

    describe('the project', function () {

    });


    // Each file
    describeEach('file').withIdenfier('filename').inArray(data.files, function (file) {
      describe('description', function () {
        it('should be string', function () {
          expect(file.description).ifDefined.toBeString();
        });
        it('should have converted description from markdown to html', function () {
          expect(file.description).ifDefined.toContain('<p>');
        })
      });
      describe('@author', function () {
        it('should be an array', function () {
          expect(file.author).ifDefined.toBeArray();
        });
        describeEach('author').withIdenfier('name').inArray(file.author, function (author) {
          it('should be an object', function () {
            expect(author).toBeObject();
          });
          it('should have at most a name and email', function () {
            expect(author).toAtMostHaveProperties('name', 'email');
          })
          it('should have a name that is a string (if defined)', function () {
            expect(author.name).ifDefined.toBeString();
          });
          it('should have an email that is a string (if defined)', function () {
            expect(author.email).ifDefined.toBeString();
          })
        });
      });
      describe('@see', function () {
        it('should be an array', function () {
          expect(file.see).ifDefined.toBeArray();
        });
        describeEach('reference').inArray(file.see, function (reference) {
          it('should be an string', function () {
            expect(reference).toBeString();
          });
        });
      });
      describe('@since', function () {
        it('should be a string', function () {
          expect(file.since).ifDefined.toBeString();
        });
      });
      describe('@title', function () {
        it('should be a string', function () {
          expect(file.title).toBeString();
        });
      });
      describe('@version', function () {
        it('should be a string', function () {
          expect(file.version).ifDefined.toBeString();
        });
      });
    });

    describe('all classes', function () {

    });

    describe('all attributes', function () {

    });

    describe('all methods', function () {

    });
    var file = data.files[1];

    describe('the file', function () {
      describe('description', function () {
        it('should have a description', function () {
          expect(file.description).toContain('If the tests succeed');
        });
        it('should have converted description from markdown to html', function () {
          expect(file.description).toContain('<p>');
        })
      });
      describe('@author', function () {
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
      });
      describe('@see', function () {
        it('should have two references (@sees)', function () {
          expect(file.sees.length).toBe(2);
        })
      });
      describe('@since', function () {
        it('should have a date that this has been relevant since', function () {
          expect(file.since).toBeDefined();
        });
      });
      describe('@title', function () {
        it('should have a title', function () {
          expect(file.title).toBeDefined();
        });
      });
      describe('@version', function () {
        it('should have a version', function () {
          expect(file.version).toBeDefined();
        });
      });
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
});