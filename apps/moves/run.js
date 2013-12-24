
    
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    nodeservice = require('../../lib/services/nodejs/service'),
    u = nodeindx.utils,
    _ = require('underscore')
    jQuery = require('jquery'),
    path = require('path');

var MovesService = Object.create(nodeservice.NodeService, {
    run: { 
        value: function(store) {
            // run continuously
            var this_ = this, config = this.load_config();
        }
    },
    get_moves: { // ecmascript 5, don't be confused!
        value: function(store) {
            var this_ = this;
            this.load_config().then(function(config) {
                // this_.debug('config! ', config, typeof config, JSON.parse(config));
                config = JSON.parse(config);
                if (!config || !_(config).keys()) {  this_.debug(' no configuration set, aborting ');  return;  }
                var boxid = config.box;
                store.getBox(boxid).then(function(box) {
                    var sleep = config.sleep;
                    console.log('sleeeeeep');
                }).fail(function(err) { this_.debug('error getting box ', err); }); 
            }).fail(function(err) { console.error('error loading config', err); });
        }
    },
    _unpack: {
        value: function(c, box) {
            return d.promise();
        }
    }
});

if (require.main === module) { 
    var ws = Object.create(MovesService);
    // needs to know where we are so that it can find our filename
    ws.init(path.dirname(module.filename));
}

