/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module */

/**
 *  Blaster Service for INDX ---
 *  This is an INDX service that grabs data from indx and turns it into magical RDF!
 *  Complies with INDX Entity Semantics 1.0 for People, Places, and Activities
 */

var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    nodeservice = require('../../lib/services/nodejs/service'),
    u = nodeindx.utils,
    ajax = require('../../lib/services/nodejs/node_ajax')(u),    
    _ = require('underscore'),
    jQuery = require('jquery'),
    path = require('path'),
    https = require('https'),
    output = nodeservice.output,
    angular = require('angular'),
    injector = nodeindx.injector,
    exporter = require('./exporter'),
    entities = injector.get('entities');


var getChannels = function(box) {  return box.query({type:'IndxChannel'}); };

var makeTestChannels = function(box) { 
    var test_channels = [];
    // let's make a happy indx person -> foaf channel
    var foafns = 'http://xmlns.com/foaf/0.1/',
        rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs = 'http://www.w3.org/2000/01/rdf-schema#';
    test_channels.push({
        query: { type:'Person' },
        transform: function(pobj) {
            var foafag = {};
            foafag[rdf+'type'] = foafns+'Agent';
            foafag[foafns+'givenName'] = pobj.peek('given_name');
            foafag[foafns+'familyName'] = pobj.peek('surname');
            this.publish(foafag);
        }
    });
    return u.when(test_channels.map(function(tc) { 
        var jsoned = _.object( _.pairs(tc).map(function(pair) { return [pair[0],JSON.stringify(pair[1])]; }) ),
            id = 'channel-'+u.guid();
        return box.obj(id).set(jsoned).save();
    }));
};

// in-memory representation
var Channel = function(box, query, transform) {
    this.box = box; 
    this.query = query;
    this.transform = eval(transform);
};
Channel.prototype = {

};

module.exports = {
    makeTestChannels : makeTestChannels
};



