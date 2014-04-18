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
    test_box = 'c';

jasmine.getEnv().defaultTimeoutInterval = 50000;

describe('indx basic connect', function() { 
    // 
    it('tests must be invoked with host, user, and pass', function() { 
        var args = tests.get_args();
        expect(args).toBeDefined();
    });

    it('connected and login', function(done) { 
        tests.connect().then(function() { done(); });
    });
});

// box creation currently broken
// describe('creation of boxes', function() { 
//     var bname = 'testbox_' + u.guid(5), created;
//     it('creates boxes', function(done) { 
//         tests.connect().then(function(store) { 
//             store.createBox(bname).then(function() { 
//                 console.log('sucess creating box ');
//                 store.getBoxList().then(function(bL) {
//                     expect(bL.indexOf(name) >= 0).toBe(true);
//                     created = true;
//                     done();
//                 }).fail(function(e) { console.error('error listing boxes' , e); });
//             }).fail(function(e) { 
//                 console.error('error creating box', e); 
//                 expect(true).toBe(false);
//                 done();
//             });
//         });
//     });
//     it('deletes boxes', function(done) {    
//         if (created) {
//             tests.connect().then(function(store) {
//                 store.deleteBox(bname).then(function() {
//                     store.getBoxList().then(function(bL) {
//                         expect(bL.indexOf(name) >= 0).toBe(false);
//                         done();
//                     }).fail(function(e) { console.error('error listing boxes' , e); });
//                 }).fail(function(e) { console.error(' error deleting box ', e); });
//             });
//         } else { done(); }
//     }); 
// });

describe('creation of an object', function() { 
    var oid = 'testobj' + u.guid(5), 
        key = 'testkey' + u.guid(12),
        val = u.guid(239),
        part2;

    // create it
    it('creates an object', function(done) { 
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                box.getObj(oid).then(function(obj) { 
                    obj.set(key,val);
                    obj.save().then(function() { 
                        done();
                    });
                });
            });
        });
    });
    // set some vals
    it('checks if it created it', function(done) {
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                box.getObj(oid).then(function(obj) {
                    expect(obj.get(key) !== undefined).toBe(true);
                    expect(obj.get(key).length).toBe(1);
                    expect(obj.get(key)[0]).toBe(val);
                    done();
                })
            });
        });
    });
    // delete it
    it('deletes the object', function(done) {
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                box.getObj(oid).then(function(o) {
                    console.log('destroying object ', oid);
                    o.destroy().then(function(x) {
                        console.log('object destroyed.. ') ;
                        done();
                    }).fail(function(e) { console.error('error deleting ', e); });
                })
            });
        });
    });
    // check deleted
    it('deleted the object successfully', function(done) {
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                var ids = box.getObjIDs();
                expect(ids.indexOf(oid)).toBe(-1);
                done();
            });
        });
    });

});