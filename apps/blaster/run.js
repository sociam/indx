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
    exporter = require('./exporter')
    entities = injector.get('entities');

var BlasterService = Object.create(nodeservice.NodeService, {
    run: { 
        value: function() {

            var this_ = this, config = this.config, store = this.store,
                types = config.types && config.types.split(',') || '*',
                catchup = config.catchup || false,
                format = config.format || 'ntriples',
                target_url = config.target_url;

            console.log('blaster target url : ', target_url);
            console.log('blaster target types : ', types);
            console.log('blaster catchup : ', catchup); 
            
            store.getBox(config.box).then(function(box) { 
                box.on('obj-add', function(id) { 
                    console.log('object add!! ', id);
                    exporter.exportObj(box, id, format).then(function(data) { 
                        console.log('data! ', data);
                        if (target_url) { 
                            console.log('attempting to put ..');
                            ajax({ type:"PUT", url:target_url, data:{data:data} }).then(function(x) { 
                                console.log("success putting!!");
                            }).fail(function(e) { 
                                console.error('fail putting ', e); 
                            });
                        }
                    });
                }); 
            });



            process.stdin.resume();
        }
    }
});

var instantiate = function(indxhost) { 
    var d = u.deferred();
    var ws = Object.create(BlasterService);
    ws.init(path.dirname(module.filename)).then(function() { 
        if (indxhost){ ws.setHost(indxhost); }
        d.resolve(ws);
    }).fail(function(bail) {
        console.log('instantiate exit >> ');
        output({event:'error', message:bail.message || bail.toString()});
        process.exit(1);
        d.reject();
    });
    return d.promise();
};

module.exports = {
    instantiate: instantiate,
    entities:entities,
    testRun: function(host) {
        var d = u.deferred();
        instantiate(host).then(function(svc) { 
            svc.login().then(function() { 
                svc._loadBox().then(function() { 
                    // console.log('done loading!! ');
                    d.resolve(svc);
                }).fail(d.reject);
            }).fail(d.reject);
        });
        return d.promise();
    }
};
if (require.main === module) { 
    var entities = injector.get('entities');
  
    // needs to know where we are so that it can find our filename
    instantiate().then(function(blaster) {
        blaster.check_args();
    });
}