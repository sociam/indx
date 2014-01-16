    
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
            this.debug('hello i am moves');
            this._init(store).then(function(config, box, diary) {
                this_.box = box;
                this_.diary = diary;
                this_.config = config;
                this_.store = store;
                // setInterval(function() { this_._update(); }, config.sleep);
                this_._update();
            });
        }
    },
    _update: {
        value:function(box,diary){
            if (!this.tokenset) {
                this.getAccessToken().then(function(tokenset) {
                    console.log('yup got token ', tokenset);
                    this_.tokenset = tokenset;
                });
            }
        }
    },
    getAccessToken: {
        value:function() {            
            var d = u.deferred(), this_ = this;
            var base_url = 'https://api.moves-app.com/oauth/v1/access_token';           
            var params = {
                grant_type: 'authorization_code',
                code:encodeURIComponent(this_.config.authcode),
                client_id:encodeURIComponent(this_.config.clientid),
                client_secret:encodeURIComponent(this_.config.clientsecret),
                redirect_uri:encodeURIComponent([this_.store._getBaseURL(), "apps", "moves", "moves_redirect.html"].join('/'))
            };
            var url = base_url+"?"+jQuery.param(params);
            console.log('url >> ', url);
            jQuery.ajax({
                type:'POST', 
                url:url
            }).then(function(response) {
                console.log('response >> ', response);
                d.resolve(response);
            }).fail(function(err) {
                console.error('error>> ', err, err.statusCode());

            })
            return d.promise();
        }
    },
    _init: { // ecmascript 5, don't be confused!
        value: function(store) {
            var this_ = this, config, d = u.deferred();
            this.load_config().then(function(config_) {
                this_.debug('config! ', config_)
                config = config_;
                if (!config || !_(config).keys()) {  
                    this_.debug(' no configuration set, aborting ');  return;  
                    d.reject();
                }
                var boxid = config.box;
                store.getBox(boxid).then(function(box) {
                    // get moves diary
                    box.getObj('moves-diary').then(function(obj) { d.resolve(config,box,obj); }).fail(function() { 
                        d.reject();
                    });
                }).fail(function(err) { this_.debug('error getting box ', err); }); 
            }).fail(function(err) { console.error('error loading config', err); });
            return d.promise();
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

