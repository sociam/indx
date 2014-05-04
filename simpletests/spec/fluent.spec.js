/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, describe, it, expect, jasmine*/

/**
 *  Simple test runner for INDX ---
 *   (c) 2014 - Max Van Kleek, University of Southampton 
 * 
 *  This is an INDX runner that teests some random things
  */

var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore'),
    jQuery = require('jquery'),
    tests = require('../common'),
    test_box_id = process.env.box || 'test';

console.log("USING BOX ", test_box_id);

jasmine.getEnv().defaultTimeoutInterval = process.env.timeout && parseInt(process.env.timeout)|| 50000;

var fail = function(donefn) { 
    return function() { 
        expect(false).toBe(true);
        if (donefn) { donefn(); }
    };
};

describe('box proxy for existing box should work', function() { 
    // 
    it('should return a valid box with then', function(done) { 
        tests.connect().then(function(store) {
            var p = store.box(test_box_id);
            expect(p).toBeDefined();
            p.then(function(box) { 
                console.log('boxitty box box ? ');
                expect(box).toBeDefined();
                expect(box.id).toBe(test_box_id);
                done();
            });
            // done();
        });
    });

    it('should get an obj', function(done) { 
       var objid = 'object-' + u.guid();
       tests.connect().then(function(store) {
            store.box(test_box_id).obj(objid).then(function(obj) {
                expect(obj).toBeDefined();
                expect(obj.id).toBe(objid)
                done();
            }).fail(fail(done));
        }); 
    });

    it('should get several objs', function(done) { 
       var oids = u.range(0,100).map(function(x) { return 'object-' + u.guid(); });
       tests.connect().then(function(store) {
            store.box(test_box_id).obj(oids).then(function(objs) {
                expect(objs).toBeDefined();
                expect(objs.length).toBe(oids.length);
                _(objs).map(function(obj, i) {
                    expect(obj).toBeDefined();
                    expect(obj.id).toBe(oids[i]);
                });
                done();
            }).fail(fail(done));
        }); 
    });

    it('should fail with a nonexistent box', function(done) { 
        tests.connect().then(function(store) {
            var p = store.box(test_box_id+"-fail");
            expect(p).toBeDefined();
            p.then(fail(done));
            p.fail(function(err) { 
                expect(err).toBeDefined();
                done();
            });
        });
    });
});

