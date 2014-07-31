/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module */

/**
 *  Blaster Service for INDX ---
 *  This is an INDX service that grabs data from indx and turns it into magical RDF!
 *  Complies with INDX Entity Semantics 1.0 for People, Places, and Activities
 */

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

var makeTestChannels = function(box) { 
    var test_channels = [];
    // let's make a happy indx person -> foaf channel
    var foafns = 'http://xmlns.com/foaf/0.1/',
        rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs = 'http://www.w3.org/2000/01/rdf-schema#';

    test_channels.push({
        name:'foafiser',
        query: { type:'Person' },
        destbox:'foafs',
        transform: function(pobj) {
            var foafag = {};
            foafag[rdf+'type'] = foafns+'Agent';
            foafag[foafns+'givenName'] = pobj.peek('given_name');
            foafag[foafns+'familyName'] = pobj.peek('surname');
            return foafag;
        }
    });
    return u.when(test_channels.map(function(tc) { 
        var jsoned = _.object( _.pairs(tc).map(function(pair) { return [pair[0],JSON.stringify(pair[1])]; }) ),
            id = 'channel-'+u.guid();
        jsoned.type = 'IndxChannel';
        return box.obj(id).set(jsoned).save();
    }));
};

// in-memory representation
var Channel = Backbone.Model.extend({ 
    initialize:function(params, options) { 

    },
    publish:function(d) { 
        // can be overridden to ... 
        //   1. add to persistent queue for something
        //   2. POST it to a destination ..
        //   3. whatever you want!
        console.log('publishing >> ', d);
    }
});

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
    getChannels : function(box) {  
        var d = u.deferred();
        box.query({type:'IndxChannel'}).then(function(chobjs) {
            d.resolve(chobjs.map(function(x) {
                return new Channel(JSON.parse(x.peek('name')), 
                    x.peek('query') && JSON.parse(x.peek('query')), 
                    x.peek('transform') && eval(x.peek('transform')));
            }));
        }); 
        return d.promise();
    }
});

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

