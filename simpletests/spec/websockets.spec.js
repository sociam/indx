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

describe('websocket diff test', function() {

    it('connect to the websocket and run stuff', function(done) {
        tests.connect().then(function(store) { 
            store.getBox(test_box).then(function(box) { 

                var token = box._getCachedToken() || box.getStoredToken(),
                    diffid,
                    responses = {},

                    send = function(msg) {
                        var deferred = new jQuery.Deferred();
                        var reqid = u.guid(12);
                        responses[reqid] = deferred;

                        msg.requestid = reqid;
                        msg.token = token;
                        if (diffid) { msg.diffid = diffid; }

                        box.wsh._ws.send(JSON.stringify(msg));
                        return deferred;
                    };

                box.wsh._ws.onmessage = function(evt) {
                    var msg = JSON.parse(evt.data),
                        reqid = msg.requestid;

                    if (reqid in responses) { // ignore msgs like diff updates etc that are not started by us
                        expect(msg.success).toBe(true);
                        if (msg.success) {
                            responses[reqid].resolve(msg);
                        } else {
                            responses[reqid].reject(msg);
                        }
                        delete responses[reqid];
                    }
                };

                send({"action": "diff", "operation": "start"}).then(function (msg) {
                    diffid = msg.diffid;
                    send({"action": "diff", "operation": "addIDs", "ids": ["obj1"]}).then(function (msg) {
                        send({"action": "diff", "operation": "setQuery", "query": "{'type': 'Person'}"}).then(function (msg) {
                            console.log("All tests successful.");
                            done();
                        }).fail(function (msg) {
                            console.error("Failed to call 'diff' / 'setQuery'");
                            done();
                        });
                    }).fail(function (msg) {
                        console.error("Failed to call 'diff' / 'addIDs'");
                        done();
                    });
                }).fail(function (msg) {
                    console.error("Failed to call 'diff' / 'start'");
                    done();
                });
            });
        });
    });

});

