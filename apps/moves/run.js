    
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    nodeservice = require('../../lib/services/nodejs/service'),
    u = nodeindx.utils,
    _ = require('underscore')
    jQuery = require('jquery'),
    path = require('path'),
    https = require('https');

var MovesService = Object.create(nodeservice.NodeService, {
    run: { 
        value: function(store) {
            // run continuously
            var this_ = this;
            this_.store = store;

            this.load_config().then(function(config) { 
                this_.config = config;
                this_.debug('hello i am moves', config);

                var doinit = function() {
                    console.log('doinit() -- ', config);
                    this_._init(store).then(function(box, diary) {
                        this_.box = box;
                        this_.diary = diary;
                        this_._update();
                     }).fail(function(er) { 
                        console.error('Error in _init ', er); 
                        process.exit(-1); 
                    });
                };

                if (config.authcode) {
                    // can only be used once
                    var code = config.authcode;
                    this_.debug('Getting access token from authcode > ', code);
                    var cont = function(authtokens) {
                        delete config.authcode;
                        console.error('positive cont ');
                        _(config).extend(authtokens);
                        this_.save_config(config).then(doinit).fail(function() { 
                            console.error('error saving authtokens ', config); 
                            process.exit(-1);
                        });
                    };
                    this_.getAccessToken().then(cont).fail(function(err) { 
                        console.error('error getting authtokens', err);
                        this_.debug('deleting authcode >> done.');
                        delete config.authcode;
                        this_.save_config(config).then(function() { process.exit(-1); });
                    });
                } else if (config.access_token) {
                    console.log('we have an access code, boyzz - init');
                    doinit();
                }
            }).fail(function(x) { 
                console.error("error load config :: ", x);
                process.exit(-1);                
            });
        }
    },
    _update: {
        value:function(box,diary){
            // if (!this.tokenset) {
            //     this.getAccessToken().then(function(tokenset) {
            //         console.log('yup got token ', tokenset);
            //         this_.tokenset = tokenset;
            //     });
            // }
        }
    },
    getAccessToken: {
        value:function() {            
            var d = u.deferred(), this_ = this;
            var base_url = 'https://api.moves-app.com/oauth/v1/access_token';
            var params = {
                grant_type: 'authorization_code',
                code:this_.config.authcode,
                client_id:this_.config.clientid,
                client_secret:this_.config.clientsecret,
                redirect_uri:[this_.store._getBaseURL(), "apps", "moves", "moves_redirect.html"].join('/')
            };
            console.log('REDIRECT >>> ', params.redirect_uri);
            console.log("CODE >> ", params.code);
            var url = base_url +"?"+jQuery.param(params);
            jQuery.post(url).then(function(result) {
                console.log('success >> ', result, typeof result);
                d.resolve(result);
            }).fail(function(bail) { 
                console.error('error >> ', bail);
                d.reject(bail);
            });
            return d.promise();
        }
    },
    checkAccessToken: {
        value:function() {            
            var d = u.deferred(), this_ = this;
            var base_url = 'https://api.moves-app.com/oauth/v1/tokeninfo';
            var params = {
                tokeninfo:this_.config.access_token,
            };
            var url = base_url +"?"+jQuery.param(params);
            jQuery.post(url).then(function(result) {
                // token is valid
                console.info('token valid >> ', result);
                d.resolve(result);
            }).fail(function(bail) { 
                // token isn't valid anymore
                console.error('error >> ', bail);
                d.reject(bail);
            });
            return d.promise();
        }
    },
    refreshToken: {
        value:function() {            
            var d = u.deferred(), this_ = this;
            var base_url = 'https://api.moves-app.com/oauth/v1/access_token';
            var params = {
                grant_type: 'refresh_token',
                refresh_token:this_.config.refresh_token,
                client_id:this_.config.clientid,
                client_secret:this_.config.clientsecret
            };
            var url = base_url +"?"+jQuery.param(params);
            jQuery.post(url).then(function(result) {
                // token is valid
                console.info('refresh ok, clobbering >> ', result, typeof result);
                _(config).extend(result);
                this_.save_config(config).then(function() {
                   d.resolve(result); 
                }).fail(function() { 
                    d.reject();
                });
            }).fail(function(bail) { 
                // token isn't valid anymore
                console.error('error >> ', bail);
                d.reject(bail);
            });
            return d.promise();
        }
    },

    _init: { // ecmascript 5, don't be confused!
        value: function(store) {
            var this_ = this, config = this.config, d = u.deferred();
            if (!config || !_(config).keys()) {  
                this_.debug(' no configuration set, aborting ');  
                d.reject();
                process.exit(-1);
                return;
            }
            var boxid = config.box;
            store.getBox(boxid).then(function(box) {
                // get moves diary
                box.getObj('moves-diary').then(function(obj) { 
                    d.resolve(box,obj); 
                }).fail(function() { 
                    d.reject();
                });
            }).fail(function(err) { this_.debug('error getting box ', err); }); 
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

