/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module */

/**
 *  Moves Service for INDX ---
 *   (c) 2014 - Max Van Kleek, University of Southampton 
 * 
 *  This is an INDX service that grabs data from moves app: https://dev.moves-app.com/
 *  Complies with INDX Entity Semantics 1.0 for People, Places, and Activities
 */

var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore'),
    jQuery = require('jquery'),
    tests = require('../common');

jasmine.getEnv().defaultTimeoutInterval = 30000;

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

describe('creation of boxes', function() { 
    var bname = 'testbox' + u.guid(5), created;
    it('creates boxes', function(done) { 
        tests.connect().then(function(store) { 
            store.createBox(bname).then(function() { 
                store.getBoxList().then(function(bL) {
                    expect(bL.indexOf(name) >= 0).toBe(true);
                    created = true;
                    done();
                }).fail(function(e) { console.error('error listing boxes' , e); });
            }).fail(function(e) { console.error('error created box', e); });
        });
    });
    if (created) {
        it('deletes boxes', function(done) {    
            tests.connect().then(function(store) {
                store.deleteBox(bname).then(function() {
                    store.getBoxList().then(function(bL) {
                        expect(bL.indexOf(name) >= 0).toBe(false);
                        done();
                    }).fail(function(e) { console.error('error listing boxes' , e); });
                }).fail(function(e) { console.error(' error deleting box ', e); });
            });
        });
    }
});