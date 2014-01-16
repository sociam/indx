    
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
            // console.log('url >> ', url, params);

            var partial = '/oauth/v1/access_token'+"?"+jQuery.param(params);
            console.log('partial >> ', partial);

            var post_options = {
              host: 'api.moves-app.com',
              port: '443',
              path: partial,
              method: 'POST',
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': 0
              }
            };
            var chunks = '', error;
            // Set up the request
            var post_req = https.request(post_options, function(res) {
              res.setEncoding('utf8');
              res.on('data', function (chunk) {
                  console.log('POST Response: ' + chunk);
                  chunks += chunk;
              });
              res.on('error', function(error) {
                  error = true;
                  console.log('POST Error Response: ' + error);
                  d.reject(error);
              });
              res.on('end', function() { 
                if (!error) {
                   console.log('end!!', chunks);
                   d.resolve(JSON.parse(chunks));
                }
              });
            });
            post_req.end();

            // jQuery.post(url).then(function(response) {
            //     console.log('YAY GOT AUTHENTICATION CODE >> ', response);
            //     _(this_.config).extend(response);
            //     this_.save(this_.config);
            //     console.log('saved config >> ', this_.config);
            //     d.resolve(response);
            // }).fail(function(err) {
            //     console.error('error >> ', err, err.statusCode());
            //     d.reject(err);
            // })
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

