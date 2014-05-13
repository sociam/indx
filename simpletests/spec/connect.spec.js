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
    test_box = process.env.box || 'test';

console.log("USING BOX ", test_box);

jasmine.getEnv().defaultTimeoutInterval = process.env.timeout && parseInt(process.env.timeout)|| 10000;

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
                    console.log('key ', key, ' - ', val);
                    console.log('object -- ', obj.attributes);
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

describe('object star stress test', function() { 
    var N = process.env.starN && parseInt(process.env.starN) || 10, 
        ids = u.range(N).map(function(x) { return 'star-stress-' + u.guid(5); });

    it('creates the objects', function(done) { 
        console.log(' creates the objects  ', ids.length);
        var os = {};
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                box.getObj(ids).then(function(objs) {
                    objs.map(function(v) { os[v.id] = v; });
                    var saved =  objs.map(function(o) {
                        var allbutme = _(os).omit(o.id);
                        expect(_(allbutme).size()).toBe(N-1);

                        
                        o.set(allbutme);
                        // console.log('setting allbutme ', allbutme);
                        o.set('all', objs);
                        return o.save();
                    }); 
                    u.when(saved).then(function() {
                        console.log('done saving');
                        done();
                    }).fail(function(err) { 
                        console.error('fail saving', err);
                        expect(true).toBe(false);
                        done();
                    })
                });
            });
        });
    });
    it('loads and tests the objects', function(done) { 
        console.log('load and test the objects ------------- ');
        var os = {};        
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 
                console.log('getting ids ------------------------------------- !', ids.length);
                box.getObj(ids).then(function(objs) {
                    console.log('got ids ...  ', objs.length);
                    try {
                        // first make sure we got all of the objects back
                        expect(objs.length).toBe(N);
                        // second, let's build up an array
                        objs.map(function(v) { os[v.id] = v; });
                        objs.map(function(o){ 
                            var keys = _(ids).without(o.id);
                            // console.log(o.id, ' - keys > ', keys);
                            // expect(keys.length).toBe(N); // 'all' + 'each of the ids'
                            keys.map(function(k) { 
                                 expect(o.get(k)).toBeDefined();
                                 expect(o.get(k).length).toBe(1);
                                 expect(o.get(k)[0]).toBe(os[k]);
                            });
                            expect(o.get('all')).toBeDefined();
                            expect(o.get('all').length).toBe(N);
                            expect(_(o.get('all')).difference(objs).length).toBe(0);
                        });
                        done();
                    } catch(e) { 
                        console.error(e); 
                        done();
                    }
                });
            });
        });
    });

});
