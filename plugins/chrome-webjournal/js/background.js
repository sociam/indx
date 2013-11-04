
(function() {
    var server;
    var DEFAULT_URL = 'https://indx.local:8211';
    var OBJ_TYPE = 'web-page-view';
    localStorage.indx_url = localStorage.indx_url || DEFAULT_URL;
    var get_box_name = function() {   return localStorage.indx_box || 'lifelog'  };
    var connect = function(client,utils) {
        var server_url = localStorage.indx_url;
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
    angular.module('webjournal', ['indx']).controller('popup', function($scope, watcher, client, utils) {
        window.$s = $scope;
        var get_store = function() {
            var bp = chrome.extension.getBackgroundPage();
            return bp.store;
        };
        var get_watcher = function() {
            var bp = chrome.extension.getBackgroundPage();
            return bp.watcher_instance;
        };
        $scope.date = function(d) { return new Date().toLocaleTimeString(); };
        $scope.duration = function(d) { return (d.end.valueOf() - d.start.valueOf()) / 60000; };
        $scope.shorten = function(url) { 
            var noprot = url.slice(url.indexOf('//')+1);
            var host = noprot.slice(0,noprot.indexOf('/'));
            var path = noprot.slice(noprot.lastIndexOf('/'));
            if (path.indexOf('?') >= 0) { 
                path = path.slice(0,path.indexOf('?'));
            }
            return host + "/" + path;
        };
        $scope.data = get_watcher().data;
    }).controller('options', function($scope, watcher, client, utils) {
        // options screen only  -------------------------------------------
        window.$s = $scope;
        var logout = function() {
            utils.safe_apply($scope, function() { 
                $scope.status = 'logged out ';
                delete $scope.user;
            });
        };
        var helper = function() {
            var me = arguments.callee;
            connect(client,utils).then(function(server, result) {
                utils.safe_apply($scope, function() {
                    if (!result.is_authenticated) {
                        $scope.status = 'connected but not logged in';
                        $scope.status_error = true;
                        return setTimeout(function() { console.info('not logged in, trying again '); me(); }, 1000);
                    }
                    $scope.status = 'connected as ' + result.name || result.username;
                    $scope.user = result;
                    $scope.status_error = false;
                    server.get_box_list().then(function(boxes) { 
                        console.log('boxes', boxes);
                        utils.safe_apply($scope, function() { $scope.boxes = boxes; });
                    });
                    // for feedback
                    server.get_box(get_box_name()).then(function(box) {
                        console.log('got box by name ', box);
                        box.on('obj-add', function(objid) {
                            console.log('new obj - -', objid);
                            // if (obj.get('type') && obj.get('type')[0] == OBJ_TYPE) {
                            //     box.get_obj(obj)
                            // }
                        });
                    });
                    server.on('disconnect', function() { 
                        utils.safe_apply($scope, function() { 
                            console.info('received ws:disconnect, waiting 10 and reconnecting ');
                            $scope.status = 'disconnected ';
                            delete $scope.user;
                        });
                        setTimeout(me, 10000); 
                    });
                    server.on('logout', logout);
                });
            }).fail(function(err) { 
                delete $scope.user;
                utils.safe_apply($scope, function() { $scope.user_logged_in = 'error connecting'; });
                setTimeout(function() { console.log('error connecting ', err, 'going again >>'); me(); }, 1000);
            });
        };
        helper();
        $scope.server_url = localStorage.indx_url;
        $scope.set_server = function(url) { 
            console.log('setting server ... ', url);
            localStorage.indx_url = $scope.server_url;
            helper();
        };
        $scope.box_selection = localStorage.indx_box;
        $scope.set_box = function(boxid) { 
            console.log('setting box ', boxid);
            localStorage.indx_box = boxid;
            watcher.set_box(boxid);
        };
    }).controller('main', function($scope, watcher, client,utils) {
        // main 
        window.utils = utils;
        var init = function(store) {
            window.s = store;
            var winstance = watcher.init(store);
            store.on('disconnect', function() {
                winstance.set_box(); // disconnect box
                console.error('diconnect >> waiting 1 second before reconnection');
                setTimeout(function() {  runner(); }, 1000);
            });
            winstance.on('error', function() {
                console.error('ERROR. Trying again in 5 seconds...');
                setTimeout(function() { runner(); }, 5000);
            });
            window.watcher_instance = winstance;
            winstance.on('new-record', function() { 
                chrome.browserAction.setBadgeText({text:''+winstance.data.length});
                chrome.browserAction.setBadgeBackgroundColor({color:"#00ff00"});
            });
        };
        var runner = function() {
            var me = arguments.callee;
            connect(client,utils).then(init)
                .fail(function(err) { console.error('cannot connect -- ', err); setTimeout(me, 10000); });
        };
        runner();
    }).factory('watcher', function(utils, client) {
        var WindowWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                console.log('initialise .. ');
                var this_ = this;
                this.data = [];
                this.bind("change", function() {  
                    if (this_.get('enabled')) { this_.change.apply(this_, arguments); } 
                });

                // window created
                // created new window, which has grabbed focus
                chrome.windows.onCreated.addListener(function(w) {
                    if (w && w.id) {
                        console.log('on created >> ', w);
                        chrome.tabs.getSelected(w.id, function(tab) { this_.trigger("change", tab.url);  });
                    }
                });
                // removed window, meaning focus lost
                chrome.windows.onRemoved.addListener(function(window) { this_.trigger("change", undefined); });

                // window focus changed
                chrome.windows.onFocusChanged.addListener(function(w) {
                    if (w >= 0) {
                        chrome.tabs.getSelected(w, function(tab) {
                            // console.info("window focus-change W:", w, ", tab:", tab, 'tab url', tab.url);
                            this_.trigger("change", tab !== undefined ? tab.url : undefined);
                        });
                    }
                });
                // tab selection changed
                chrome.tabs.onSelectionChanged.addListener(function(tabid, info, t) {
                    chrome.tabs.getSelected(info.windowId, function(tab) {
                        // console.info("tabs-selectionchange ", info.windowId, ", tab ", tab && tab.url);
                        this_.trigger("change", tab !== undefined ? tab.url : undefined);
                    });
                });
                // updated a tab 
                chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, t) {
                    // console.info("tab_updated", t.url, changeinfo.status);
                    if (changeinfo.status == 'loading') { return; }
                    this_.trigger("change", t.url);
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
                console.log('load appropriate box >>>>>>>>>> ', get_box_name());
                this.set_box(get_box_name());
            },
            set_box:function(bid) {
                if (!bid) { 
                    // resetting...
                    delete this.box;
                    return;                    
                }
                // console.log('attempting to set box >> ', bid);
                var this_=  this, store = this.get('store');
                store.get_box(bid).then(function(b) { 
                    console.log('got box --- ', b);
                    window.b = b;
                    // console.info('successfully got box ', bid);
                    this_.box = b;  
                }).fail(function(err) {
                    console.error('!!!!!! error getting box ', bid);
                    delete this_.box;
                });
            },
            change:function(url) {
                var this_ = this;
                setTimeout(function() { 
                    var now = new Date();
                    if (this_.current_record !== undefined) {
                        this_.current_record.end = now;
                        this_._record_updated(this_.current_record);
                        if (url === this_.current_record.location) { 
                            // we're done
                            // console.info('just updated, returning');
                            return;
                        } else {
                            // different now
                            // console.log('new record!');
                            delete this_.current_record;
                            this_.trigger("new-record", this_.current_record);
                        }
                    }
                    // go on to create a new record
                    if (url !== undefined) {
                        this_.current_record = this_.make_record({start: now, end:now, to: url, location: url});
                        this_.data.push(this_.current_record);
                        this_._record_updated(this_.current_record);
                    }
                });
            },
            make_record:function(options) {
                // console.log("make record >> ", options);
                return _({}).chain().extend(options).extend({id:utils.guid(), type:OBJ_TYPE}).value();
            },
            _record_updated:function() {
                // console.log('record updated ... box ', this.box, this.current_record);
                var this_ = this;
                if (this.box !== undefined && this.current_record !== undefined) {
                    var id = "webjournal-log-"+this.current_record.id, box = this_.box;
                    var rec = _(this.current_record).chain().clone().omit('id').value();
                    box.get_obj(id).then(function(obj) {
                        obj.set(rec); 
                        obj.save().then(function() { u.log('webjournal saved ', obj.id); })
                        .fail(function(err) { 
                            u.error('webjournal save fail '); 
                            this_.trigger('error', err);
                        });
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
        set_box:function(b) { 
            if (this.watcher) {
                this.watcher.set_box(b);
            }
        },
        set_store:function(store) { 
            if (this.watcher) { 
                this.watcher.set('store', store); 
                this.watcher.load_appropriate_box();
            }
        },
        set_enabled:function(enabled) {
            if (this.watcher) { this.watcher.set('enabled', enabled); }
            return false;
        },
        get_enabled:function() {
            if (this.watcher) { return this.watcher.get('enabled'); }
            return false;
        },
        set_polling:function(polling) {
            polling ? this.watcher.start_polling() : this.watcher.end_polling();
        }
    };
    });
}());
