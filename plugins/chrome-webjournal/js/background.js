
(function() {
    var server;
    var connect = function(client,utils) {
        var server_url = localStorage.indx_url || 'https://indx.local:8211';
        if (server === undefined || server.get('server_host') !== server_url) {
            server = new client.Store({server_host:server_url});
        }
        var d = utils.deferred();
        server.check_login().then(function(response) {
            console.log('check login response >>>>>> ', response);
            if (response.is_authenticated) {  
                return d.resolve(server, response);  
            };
            d.reject('not logged in');
        }).fail(d.reject);
        return d.promise();
    };
    angular.module('webjournal', ['indx'])
    .controller('options', function($scope, watcher, client, utils) {
        // options screen only  -------------------------------------------
        var helper = function() {
            var me = arguments.callee;
            connect(client,utils).then(function(server, result) {
                utils.safe_apply($scope, function() {
                    if (!result.is_authenticated) {
                        $scope.user_logged_in = 'not logged in';
                        return setTimeout(function() { console.info('not logged in, trying again '); me(); }, 1000);
                    }
                    $scope.user_logged_in = result.name || result.username;
                    server.on('disconnect', function() { 
                        console.info('received ws:disconnect, waiting 10 and reconnecting ');
                        setTimeout(me, 10000); 
                    });
                });
            }).fail(function(err) { 
                utils.safe_apply($scope, function() { $scope.user_logged_in = 'error connecting'; });
                setTimeout(function() { console.log('error connecting ', err, 'going again >>'); me(); }, 1000);
            });
        };
        helper();
    }).controller('main', function($scope, watcher, client,utils) {
        // main 
        window.utils = utils;
        var init = function(store) { 
            window.s = store;
            console.log('connect success >>', store);
            var winstance = watcher.init(store);
            store.on('disconnect', function() { 
                winstance.set_box(); // disconnect box
                console.error('diconnect >> waiting 1 second before reconnection');
                setTimeout(function() {  runner(); }, 1000); 
            });
        };
        var runner = function() { 
            var me = arguments.callee;
            connect(client,utils)
                .then(init)
                .fail(function(err) { console.error('cannot connect -- ', err); setTimeout(me, 10000); });
        };
        runner();
    }).factory('watcher', function(utils, client) {
        var WindowWatcher = Backbone.Model.extend({
            initialize:function(attributes) {
                console.log('initialise .. ');
                var this_ = this;
                this.data = [];
                this.bind("change", function() {  this_.change.apply(this_, arguments);   });
                // created
                chrome.windows.onCreated.addListener(function(window) {
                    chrome.tabs.getSelected(window, function(tab) {
                        this_.trigger("change", tab.url);
                    });
                });
                // focus changed
                chrome.windows.onFocusChanged.addListener(function(w) {
                    console.log('getting selected of ', w);
                    if (w >= 0) {
                        chrome.tabs.getSelected(w, function(tab) {
                            console.log("focus-change ", w, ", tab ", tab);
                            this_.trigger("change", tab !== undefined ? tab.url : undefined);
                        });
                    }
                });
                // removed
                chrome.windows.onRemoved.addListener(function(window) {
                    console.log("window::onRemoved", window);
                    this_.trigger("changed", undefined);
                });
                // updated
                chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, t) {
                    if (changeinfo.status == 'loading') { return; }
                    console.log("window::tab_updated", t.url, changeinfo.status);
                    this_.trigger("change", t.url);
                });
                // selection changed
                chrome.tabs.onSelectionChanged.addListener(function(tabid, info, t) {
                    chrome.tabs.getSelected(info.windowId, function(tab) {
                        console.log("tabs-selectionchange ", window, ", tab ", tab);
                        this_.trigger("change", tab !== undefined ? tab.url : undefined);
                    });
                });
            },
            start_polling:function(interval) {
                var this_ = this;
                this.stop_polling();
                this_.poll = setInterval(function() {
                    if (this_.current_record !== undefined) {
                        this_.change(this_.current_record.location);
                    }
                }, 1000);
            },
            stop_polling:function() {
                if (this.poll) {
                    clearInterval(this.poll);
                    delete this.poll;
                }
            },
            load_appropriate_box:function(client) {
                console.log('load appropriate box >>>>>>>>>> ', localStorage.indx_box || 'lifelog'); 
                this.set_box(localStorage.indx_box || 'lifelog');
            },
            set_box:function(bid) {
                if (!bid) { 
                    // resetting...
                    delete this.box;
                    return;                    
                }
                console.log('attempting to set box >> ', bid);
                var this_=  this, store = this.get('store');
                store.get_box(bid).then(function(b) {  
                    window.b = b;
                    console.info('successfully got box ', bid);
                    this_.box = b;  
                }).fail(function(err) {
                    console.error('!!!!!! error getting box ', bid);
                    delete this_.box;
                });
            },
            change:function(url) {
                var this_ = this;
                var now = new Date();
                if (this.current_record !== undefined) {
                    this.current_record.end = now;
                    this._record_updated(this.current_record);
                    if (url === this.current_record.location) { 
                        // we're done
                        return;
                    } else {
                        // different now
                        console.log('new record!');
                        delete this.current_record;
                        this.trigger("new_record", this.current_record);
                    }
                }
                // go on to create a new record
                if (url !== undefined) {
                    this.current_record = this.make_record({start: now, end:now, to: url, location: url});
                    this.data.push(this.current_record);
                    this._record_updated(this.current_record);
                }
            },
            make_record:function(options) {
                // console.log("make record >> ", options);
                return _({}).chain().extend(options).extend({id:utils.guid()}).value();
            },
            _record_updated:function() {
                console.log('record updated ... box ', this.box, this.current_record);
                var this_ = this;
                if (this.box !== undefined && this.current_record !== undefined) {
                    var id = "webjournal-log-"+this.current_record.id, box = this_.box;
                    var rec = _(this.current_record).chain().clone().omit('id').value();
                    box.get_obj(id).then(function(obj) {
                        obj.set(rec); 
                        obj.save().then(function() { u.log('webjournal saved ', obj.id); }).fail(function(err) { u.error('webjournal save fail '); });
                    });
                }
            }
        });
    return {
        init:function(store) {
            if (!this.watcher) { 
                this.watcher = new WindowWatcher({store:store});
            }
            this.watcher.load_appropriate_box();
            return this.watcher;
        },
        set_store:function(store) { 
            if (this.watcher) { 
                this.watcher.set('store', store); 
                this.watcher.load_appropriate_box();
            }
        },
        set_polling:function(polling) {
            polling ? this.watcher.start_polling() : this.watcher.end_polling();
        }
    };
    });
}());
