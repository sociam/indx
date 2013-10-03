console.log(__karma__)
var jf = jasmine.getFixtures();
jf.fixturesPath = '/base/';
jf.load('html/index.html'); // stupid karma



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
          fn(element, i);
        });
      });
    }
    return this;
  };
  return new DescribeEach();
};

['toBeUndefined', 'toBeString', 'toBeNumber', 'toBeString',
  'toBeArray', 'toBeObject', 'toBeDefined', 'toBeFalsy',
  'toBeBoolean', 'toAtMostHaveProperties', 'toBe',
  'toContain'].forEach(function (k) {
  window[k] = function (val) {
    return [k, val];
  };
});


var expectProperties = function (actual) {
  return {
    toBe: function (obj) {
      Object.keys(obj).forEach(function (k) {
        it('property ' + k, function () {
          expect(actual[k])[obj[k][0]](obj[k][1]);
        });
      });
    }
  };
};

var where = function (arr, match) {
  var rs;
  arr.forEach(function (el) {
    if (rs) { return; }
    var pass = true;
    Object.keys(match).forEach(function (k) {
      pass = pass && el[k] === match[k];
    })
    if (pass) {
      rs = el;
    }
  })
  return rs;
};

describe('the documentation', function () {
  'use strict';

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
        var pass = true,
            accepted = Array.prototype.slice.call(arguments, 0);
        if (typeof this.actual !== 'object') {
          return false;
        }
        Object.keys(this.actual).forEach(function (key) {
          pass = pass && accepted.indexOf(key) > -1;
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
    });
  });

  describeEach('number').inArray([1, 2, 3], function (n) {
    it('is a number', function () {
      expect(n).toBeNumber();
    });
  });


  describe('data structure:', function () {

    var checkComment = function (obj, properties) {
      describe('description', function () {
        it('should be string', function () {
          expect(obj.description).ifDefined.toBeString();
        });
        it('should have converted description from markdown to html', function () {
          if (obj.description) {
            expect(obj.description).ifDefined.toContain('<p>');
          }
        });
      });
      describe('readme_description', function () {
        it('should be string', function () {
          expect(obj.description).ifDefined.toBeString();
        });
        it('should have converted description from markdown to html', function () {
          if (obj.description) {
            expect(obj.description).ifDefined.toContain('<p>');
          }
        });
      });
      if (properties.indexOf('author') > -1) {
        describe('@author', function () {
          it('should be an array', function () {
            expect(obj.author).ifDefined.toBeArray();
          });
          describeEach('author').withIdenfier('name').inArray(obj.author, function (author) {
            it('should be an object', function () {
              expect(author).toBeObject();
            });
            it('should have at most a name and email', function () {
              expect(author).toAtMostHaveProperties('name', 'email');
            });
            it('should have a name that is a string (if defined)', function () {
              expect(author.name).ifDefined.toBeString();
            });
            it('should have an email that is a string (if defined)', function () {
              expect(author.email).ifDefined.toBeString();
            });
          });
        });
      }
      if (properties.indexOf('see') > -1) {
        describe('@see', function () {
          it('should be an array', function () {
            expect(obj.see).ifDefined.toBeArray();
          });
          describeEach('reference').inArray(obj.see, function (reference) {
            it('should be an string', function () {
              expect(reference).toBeString();
            });
          });
        });
      }
      if (properties.indexOf('since') > -1) {
        describe('@since', function () {
          it('should be a string', function () {
            expect(obj.since).ifDefined.toBeString();
          });
        });
      }
      if (properties.indexOf('title') > -1) {
        describe('@title', function () {
          it('should be a string', function () {
            expect(obj.title).toBeString();
          });
        });
      }
      if (properties.indexOf('name') > -1) {
        describe('@name', function () {
          it('should be a string', function () {
            expect(obj.name).toBeString();
          });
        });
      }
      if (properties.indexOf('version') > -1) {
        describe('@version', function () {
          it('should be a string', function () {
            expect(obj.version).ifDefined.toBeString();
          });
        });
      }
      if (properties.indexOf('optional') > -1) {
        describe('@optional', function () {
          it('should be a boolean', function () {
            expect(obj.optional).ifDefined.toBeBoolean();
          });
        });
      }
      if (properties.indexOf('order') > -1) {
        describe('@order', function () {
          it('should be a number', function () {
            expect(obj.order).ifDefined.toBeNumber();
          });
        });
      }
      if (properties.indexOf('deprecated') > -1) {
        describe('@deprecated', function () {
          it('should be a string', function () {
            expect(obj.deprecated).ifDefined.toBeString();
          });
        });
      }
      if (properties.indexOf('types') > -1) {
        describe('@types', function () {
          it('should be an array', function () {
            expect(obj.types).ifDefined.toBeArray();
          });
          describeEach('type').withIdenfier('name').inArray(obj.types, function (type) {
            it('should be an object', function () {
              expect(type).toBeObject();
            });
            /*it('should have at most a name and email', function () {
              expect(author).toAtMostHaveProperties('name', 'email');
            })
            it('should have a name that is a string (if defined)', function () {
              expect(author.name).ifDefined.toBeString();
            });
            it('should have an email that is a string (if defined)', function () {
              expect(author.email).ifDefined.toBeString();
            })*/
          });
        });
      }
      if (properties.indexOf('args') > -1) {
        describe('@arg / @opt', function () {
          it('should be an array', function () {
            expect(obj.args).ifDefined.toBeArray();
          });
          describeEach('arg').withIdenfier('name').inArray(obj.args, function (arg) {
            it('should be an object', function () {
              expect(arg).toBeObject();
            });
            /*it('should have at most a name and email', function () {
              expect(author).toAtMostHaveProperties('name', 'email');
            })
            it('should have a name that is a string (if defined)', function () {
              expect(author.name).ifDefined.toBeString();
            });
            it('should have an email that is a string (if defined)', function () {
              expect(author.email).ifDefined.toBeString();
            })*/
          });
        });
      }
      if (properties.indexOf('throws') > -1) {
        describe('@throws', function () {
          it('should be an array', function () {
            expect(obj['throws']).ifDefined.toBeArray();
          });
          describeEach('throw').withIdenfier('name').inArray(obj['throws'], function (thr) {
            it('should be an object', function () {
              expect(thr).toBeObject();
            });
            /*it('should have at most a name and email', function () {
              expect(author).toAtMostHaveProperties('name', 'email');
            })
            it('should have a name that is a string (if defined)', function () {
              expect(author.name).ifDefined.toBeString();
            });
            it('should have an email that is a string (if defined)', function () {
              expect(author.email).ifDefined.toBeString();
            })*/
          });
        });
      }
      if (properties.indexOf('result') > -1) {
        describe('@return / @then / @chain', function () {
          it('should be an array', function () {
            expect(obj.result).ifDefined.toBeArray();
          });
          describeEach('result').withIdenfier('name').inArray(obj.result, function (result) {
            it('should be an object', function () {
              expect(result).toBeObject();
            });
            /*it('should have at most a name and email', function () {
              expect(author).toAtMostHaveProperties('name', 'email');
            })
            it('should have a name that is a string (if defined)', function () {
              expect(author.name).ifDefined.toBeString();
            });
            it('should have an email that is a string (if defined)', function () {
              expect(author.email).ifDefined.toBeString();
            })*/
          });
        });
      }
    }

    describe('the project', function () {
      checkComment(data.project, ['title', 'version', 'readme_description']);
    });

    // Each file
    describeEach('file').withIdenfier('filename').inArray(data.files, function (file) {
      checkComment(file, ['author', 'see', 'since', 'title', 'version']);
    });

    var classes = [];
    data.files.forEach(function (file) {
      classes = classes.concat(file.classes || []);
    });
    describeEach('class').withIdenfier('fullName').inArray(classes, function (cls) {
      checkComment(cls, ['class', 'ignore', 'extend', 'name', 'fullName',
        'instanceName', 'order', 'since', 'see', 'deprecated']);
    });
    var attributes = [];
    classes.forEach(function (cls) {
      attributes = attributes.concat(cls.attributes || []);
    });
    console.log(attributes);
    describeEach('attribute').withIdenfier('name').inArray(attributes, function (attribute) {
      console.log('A', attribute);
      checkComment(attribute, ['attribute', 'optional', 'types', 'ignore', 'order',
        'since', 'see', 'deprecated', 'name']);
    });
    var methods = [];
    classes.forEach(function (cls) {
      methods = methods.concat(cls.methods || []);
    });
    describeEach('method').withIdenfier('name').inArray(methods, function (method) {
      checkComment(method, ['method', 'args', 'result', 'throws', 'ignore', 'order',
        'since', 'see', 'deprecated']);
    });
  });

  describe('data model', function () {
    var file = data.files[1];

    describe('the file', function () {
      describe('description', function () {
        it('should have a description', function () {
          expect(file.description).toContain('If the tests succeed');
        });
        it('should have 2 classes', function () {
          expect(file.classes.length).toBe(2);
        });
      });
      describe('@author', function () {
        it('should have two authors', function () {
          expect(file.author.length).toBe(2);
        });
        it('should have two authors with names', function () {
          expect(file.author[0].name).toBeDefined();
          expect(file.author[1].name).toBeDefined();
        });
        it('should have first author with an email address', function () {
          expect(file.author[0].email).toBeDefined();
          expect(file.author[1].email).toBeUndefined();
        });
        it('should be in order', function () {
          expect(file.author[0].name).toContain('Peter West');
        });
        it('should have a Peter West with my email', function () {
          expect(file.author[0].name).toBe('Peter West');
          expect(file.author[0].email).toBe('peter@peter-west.co.uk');
        });
        it('should have another person', function () {
          expect(file.author[1].name).toBe('My buddy elsewhere');
        });
      });
      describe('@see', function () {
        it('should have two references (@see)', function () {
          expect(file.see.length).toBe(2);
        });
        it('should be two urls', function () {
          expect(file.see[0]).toMatch(/^http:\/\//);
          expect(file.see[1]).toMatch(/^http:\/\//);
        });
        it('should be in order', function () {
          expect(file.see[0]).toContain('indx.es');
        });
      });
      describe('@since', function () {
        it('should have a date that this has been relevant since', function () {
          expect(file.since).toBeDefined();
        });
        it('should be September 2013', function () {
          expect(file.since).toBe('September 2013');
        });
      });
      describe('@title', function () {
        it('should have a title', function () {
          expect(file.title).toBeDefined();
        });
        it('should be Test javascript framework', function () {
          expect(file.title).toBe('Test javascript framework');
        });
      });
      describe('@version', function () {
        it('should have a version', function () {
          expect(file.version).toBeDefined();
        });
        it('should be 0.1', function () {
          expect(file.version).toBe('0.1');
        });
      });
    });

    describe('the Farm class', function () {
      var cls = where(data.files[1].classes, { name: 'Farm' });
      it('should exist', function () {
        expect(cls).toBeDefined();
      });
      expectProperties(cls).toBe({
        title: toBe('Farm'),
        fullName: toBe('Farm'),
        instanceName: toBe('farm'),
        description: toContain('A farm consists'),
        extend: toBeFalsy(),
        ignore: toBeUndefined(),
        order: toBeUndefined(),
        since: toBeUndefined(),
        see: toBeUndefined(),
        deprecated: toBeUndefined(),
        args: toBeArray(),
        'throws': toBeUndefined()
      });

      it('should have an owner argument', function () {

      });
      it('should have two methods', function () {

      });
      describe('the sell method', function () {

      });
      describe('the addField method', function () {

      });
    });
    describe('the BigBarn class', function () {
      var cls = where(data.files[1].classes, { name: 'BigBarn' });
      it('should exist', function () {
        expect(cls).toBeDefined();
      });
      expectProperties(cls).toBe({
        title: toBe('BigBarn'),
        fullName: toBe('BigBarn'),
        instanceName: toBe('bigBarn'),
        description: toBeUndefined(),
        extend: toBeFalsy(),
        order: toBeUndefined(),
        since: toBeUndefined(),
        see: toBeUndefined(),
        deprecated: toBeUndefined(),
        args: toBeUndefined(),
        'throws': toBeUndefined()
      });
    });
    describe('the Field class', function () {
      var cls = where(data.files[1].classes, { name: 'Field' });
      it('should exist', function () {
        expect(cls).toBeDefined();
      });
      expectProperties(cls).toBe({
        title: toBe('Field'),
        fullName: toBe('Field'),
        instanceName: toBe('field'),
        description: toContain('multiple animals'),
        extend: toBeFalsy(),
        order: toBeUndefined(),
        since: toBeUndefined(),
        see: toBeUndefined(),
        deprecated: toBeUndefined(),
        args: toBeUndefined(),
        'throws': toBeUndefined()
      });
      describe('the drawCropCircle method', function () {

      });
    });
    describe('the Cow class', function () {
      var cls = where(data.files[1].classes, { name: 'Cow' });
      it('should exist', function () {
        expect(cls).toBeDefined();
      });
      expectProperties(cls).toBe({
        title: toBe('Cow'),
        fullName: toBe('Cow'),
        instanceName: toBe('cow'),
        description: toBeFalsy(),
        extend: toBeArray(),
        order: toBeString(),
        since: toBeString(),
        see: toBeArray(),
        deprecated: toBeUndefined(),
        args: toBeUndefined(),
        'throws': toBeUndefined()
      });
      it('should have a url to wikipedia', function () {
        expect(cls.see[0]).toContain('en.wikipedia');
      });
      it('should extend Animal', function () {
        expect(cls.extend[0].name).toBe('Animal');
      });
      it('should show complete info about Animal', function () {
        expect(cls.extend[0].methods).toBeArray();
      });
      describe('the drawCropCircle method', function () {

      });
    });
  });

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