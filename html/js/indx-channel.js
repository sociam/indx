/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, angular, Backbone */
/**
 *  Channels ---
 *  This is an INDX service that grabs data from indx and turns it into magical RDF!
 *  Complies with INDX Entity Semantics 1.0 for People, Places, and Activities
 */

angular.module('indx').factory('channels', function(client, utils)  {

    var u = utils,
        store = client.store;

    var testChannelDefs = function(srcboxid, dstboxid) { 
        var test_channels = [];
        // let's make a happy indx person -> foaf channel

        test_channels.push({
            name:'foafiser-'+srcboxid+'-'+dstboxid,
            query: { type:'Person' },
            destbox:dstboxid,
            transform: function(pobj) {
                var foafns = 'http://xmlns.com/foaf/0.1/',
                    rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                    rdfs = 'http://www.w3.org/2000/01/rdf-schema#',
                    foafag = {};

                foafag[rdf+'type'] = foafns+'Agent';
                foafag[foafns+'givenName'] = pobj.peek('given_name');
                foafag[foafns+'familyName'] = pobj.peek('surname');
                return foafag;
            }
        });
        return test_channels;
    };
    var defineChannel = function(id, box, definition) { 
        var d = u.deferred();
        box.getObj(id).then(function(x) { 
            x.set({
                type:'IndxChannel',
                name: definition.name,
                query: JSON.stringify(definition.query),
                destbox: definition.destbox,
                transform : definition.transform.toString()
            });
            x.save().then(d.resolve).fail(d.reject);
        });
        return d.promise();
    };

    // in-memory representation
    var Channel = Backbone.Model.extend({ 
        initialize:function(params) {
            // takes in params { obj: object }
            var obj = this.obj = params.obj, 
                transformsrc = this.transformsrc = obj.peek('transform'), 
                querysrc = this.querysrc = obj.peek('query'),
                name = this.name = obj.peek('name'),
                destbox = obj.peek('destbox'),
                boxd = u.deferred(),
                readyd = this.readyd = u.deferred(),
                this_ = this;

            // keeps the deferreds
            this.resultds = {};

            if (transformsrc !== undefined) { 
                console.info('transformsrc ', transformsrc);
                this.transform = eval("("+transformsrc+")");  
            } else {
                console.warn('no transform fn specified ', obj);                 
            }

            if (querysrc !== undefined) { 
                this.query = JSON.parse(querysrc);
            } else {
                console.warn('Query src not available ', obj);
            }
            if (!destbox) { 
                console.warn('no destination box specified for channel ', obj);
                return;
            }
            this.srcbox = obj.box;
            obj.box.store.getBox(obj.peek('destbox')).then(function(dbox) {
                this_.destbox = dbox;
                boxd.resolve();
            }).fail(boxd.reject);
            boxd.then(readyd.resolve).fail(readyd.reject);
        },
        query: {},
        start:function() { 
            var startd = u.deferred(), this_ = this;
            if (this.livequery) {  this.livequery.stop();  }
            this.readyd.then(function() { 
                this_.livequery = this_.srcbox.standingQuery(this_.query, function(result) { 
                    // callback for new result
                    this_.trigger('incoming', result);
                    console.log('new standing query result >> ', result);
                    var resultd = this_._make_resultd(result.id);
                    this_._handleResult(result).then(function(tresult) { 
                        this_.publish(tresult)
                            .then(resultd.resolve)
                            .fail(function(err) {  console.error('failure publishing ', result); resultd.reject(err) ; });
                    }).fail(function(err) { console.error('failure transforming ', result); resultd.reject(err); });
                }).then(function(livequery) {
                    this_.livequery = livequery;
                }).fail(function(err) { console.error('error starting standingQuery ... ', err); startd.reject(); });
            }).fail(startd.reject);
            return startd.promise();
        },
        _make_resultd: function(oid) { 
            var d = u.deferred();
            d.then(function() { 
                console.info('successful publishing ', oid); 
            }).fail(function(err) { 
                console.error('error publishing ', oid); 
            });
            return d;
        },
        _handleResult: function(result) {
            // gets called on live query result
            return u.dresolve(this.transform(result));
        },
        stop:function() {
            if (this.livequery) { this.livequery.stop(); }
        },
        transform:function(x) { console.warn('noop transform'); return x; },
        save:function() { 
            this.obj.set(
                { transform: this.transform.toString(), query: JSON.stringify(this.query) }
            );
            return this.obj.save();
        },
        publish:function(transformed) {
            // can be overridden to ... 
            //   1. add to persistent queue for something
            //   2. POST it to a destination ..
            //   3. whatever you want!
            console.log('publishing >> ', transformed);
            var d = u.deferred();
            if (transformed !== undefined) {
                var toid = transformed.id  || (transformed.getID && transformed.getID()) || u.guid();
                this.destbox.obj(toid).set(transformed).save().then(d.resolve).fail(d.reject);
            }
            return d.promise();
        }
    });

    var getAllBoxes = function() {
        // select only the boxes that we have read perms on
        var D = u.deferred();
        store.getBoxList().then(function(boxlist) {
            u.when(boxlist.map(function(bid) { 
                var d = u.deferred();
                // if we fail, that means we probably don't have read perms, so just skip
                store.getBox(bid).then(d.resolve).fail(function() { d.resolve(); });
                return d.promise();
            })).then(function(boxes) { D.resolve(boxes.filter(function(x) { return x; })); }).fail(D.reject);
        }).fail(D.reject);
        return D.promise();
    };

    return {
        Channel:Channel,
        getTestDefs:testChannelDefs,
        getAllBoxes:getAllBoxes,
        getChannels:function() { 
            // gets all channels from all boxes you have connections to
            var d = u.deferred();
            getAllBoxes().then(function(boxes) { 
                u.when(boxes.map(function(box) { 
                    var dc = u.deferred();
                    box.query({type:'IndxChannel'}).then(function(chobjs) {
                        dc.resolve(chobjs.map(function(x) { return new Channel({obj:x}); }));
                    }).fail(dc.reject);
                    return dc.promise();
                })).then(function(chsets) { 
                    d.resolve(chsets.reduce(function(x,y){ return x.concat(y); }, [])); 
                }).fail(d.reject);
            }).fail(d.reject);
            return d.promise();
        },
        define:defineChannel
    };

});

/* 
    Node Service stuff

    var nodeindx = require('../../lib/services/nodejs/nodeindx'),
        nodeservice = require('../../lib/services/nodejs/service'),
        ajax = require('../../lib/services/nodejs/node_ajax')(u),    
        u = nodeindx.utils,     injector = nodeindx.injector,
        _ = require('underscore'),
        jQuery = require('jquery'),
        path = require('path'),
        https = require('https'),
        output = nodeservice.output,
        Backbone = require('backbone'),
        exporter = require('./exporter'),
        entities = injector.get('entities');

    var instantiate = function(indxhost) { 
        var d = u.deferred();
        var svc = Object.create(ChannelerService);
        svc.init(path.dirname(module.filename)).then(function() { 
            if (indxhost){ svc.setHost(indxhost); }
            d.resolve(svc);
        }).fail(function(bail) {
            console.log('instantiate exit >> ');
            output({event:'error', message:bail.message || bail.toString()});
            process.exit(1);
            d.reject();
        });
        return d.promise();
    };

    module.exports = {  makeTestChannels : makeTestChannels  };

    if (require.main === module) { 
        instantiate().then(function(service) { service.check_args(); });
    }
    var ChannelerService = Object.create(nodeservice.NodeService, {
        run: { 
            value: function() {
                var this_ = this, config = this.config, store = this.store,
                    boxes = this.getAllBoxes();
            }
        },
        getAllBoxes: { 
            value: function() {
                // select only the boxes that we have read perms on
                var store = this.store, D = u.deferred();
                store.getBoxList().then(function(boxlist) {
                    u.when(boxlist.map(function(bid) { 
                        var d = u.deferred();
                        // if we fail, that means we probably don't have read perms, so just skip
                        store.getBox(bid).then(d.resolve).fail(function() { d.resolve(); });
                        return d.promise();
                    })).then(function(boxes) { D.resolve(boxes.filter(function(x) { return x; })); }).fail(D.reject);
                }).fail(D.reject);
                return D.promise();
            }
        },
    });

*/
