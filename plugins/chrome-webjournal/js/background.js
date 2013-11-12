
(function() {
    var server;
    var DEFAULT_URL = 'https://indx.local:8211';
    var setErrorBadge = function(errtext) {
        chrome.browserAction.setBadgeText({text:''+errtext});
        chrome.browserAction.setBadgeBackgroundColor({color:"#ff0000"});
    };
    var clearBadge = function() {
        chrome.browserAction.setBadgeText({text:''});
    };
    var setOKBadge = function(s) {
        chrome.browserAction.setBadgeText({text:s.toString()});
        chrome.browserAction.setBadgeBackgroundColor({color:"#00ffff"});
    };
    var duration_secs = function(d) { return (d.get('end')[0].valueOf() - d.get('start')[0].valueOf()) / 1000.0;  };
    var OBJ_TYPE = localStorage.indx_webjournal_type || 'web-page-view';
    var GEO_OBJ_TYPE = localStorage.indx_webjournal_type || 'geolocated';

    var OBJ_ID = localStorage.indx_webjournal_id || 'my-web-journal';
    var GEO_JOURNAL_ID = localStorage.indx_geojournal_id || 'my-geo-journal';

    localStorage.indx_url = localStorage.indx_url || DEFAULT_URL;
    var getBoxName = function() { return localStorage.indx_box || 'lifelog'; };

    var connect = function(client,utils) {
        var server_url = localStorage.indx_url;
        if (server === undefined || server.get('server_host') !== server_url) {
            server = new client.Store({server_host:server_url});
        }
        var d = utils.deferred();
        server.checkLogin().then(function(response) {
            if (response.is_authenticated) { 
                setOKBadge(":)");
                return d.resolve(server, response);  
            }
            d.reject('not logged in');
        }).fail(d.reject);
        return d.promise();
    };

    // declare modules -----------------|
    var app = angular.module('webjournal', ['indx'])
    .config(function($compileProvider){ 
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|chrome-extension):/); 
    })
    // popup controller
    .controller('popup', function($scope, watcher, utils) {
        window.$s = $scope;
        var records = [];
        var guid = utils.guid();
        var get_store = function() {  return chrome.extension.getBackgroundPage().store; };
        var get_watcher = function() { return chrome.extension.getBackgroundPage().watcher_instance; };

        // scope methods for rendering things nicely.
        $scope.date = function(d) { return new Date().toLocaleTimeString().slice(0,-3);  };
        $scope.duration = function(d) {
            var secs = duration_secs(d);
            if (secs < 60) {  return secs.toFixed(2) + "s"; }  
            return (secs/60.0).toFixed(2) + "m";
        };        
        $scope.label = function(d) { 
            var maxlen = 150;
            if (d === undefined || !d.get('location')) { return ''; }
            if (d.get('title') && d.get('title').length && d.get('title')[0].trim().length > 0) { return d.get('title')[0].slice(0,maxlen); }
            var url = d.get('location')[0];
            if (!url) { return ''; }
            var noprot = url.slice(url.indexOf('//')+2);
            if (noprot.indexOf('www.') === 0) { noprot = noprot.slice(4); }
            return noprot.slice(0,maxlen);
        };
        var update_history = function(history) {  
            console.log('update history >> ', update_history.length );
            utils.safeApply($scope, function() { $scope.data = history.concat().reverse(); });     
        };
        get_watcher().on('updated-history', function(history) {  update_history(history); }, guid);
        update_history(get_watcher()._get_history());
        window.onunload=function() { get_watcher().off(undefined, undefined, guid);  };
    })
    // options page
    .controller('options', function($scope, client, utils) {
        // options screen only  -------------------------------------------
        var get_watcher = function() { return chrome.extension.getBackgroundPage().watcher_instance; };
        var get_store = function() { var w = get_watcher(); if (w) { return w.get('store'); } };
        var watcher = get_watcher(), guid = utils.guid(), old_store = get_store();
        var sa = function(f) { utils.safeApply($scope, f); };
        window.$s = $scope;
        var load_stats = function(store) {
            store.getBoxList().then(function(boxes) {
                sa(function() { $scope.boxes = boxes; });
            });
            store.checkLogin().then(function(result) {
                sa(function() { 
                    if (result.is_authenticated) {
                        $scope.status = 'connected as ' + result.name || result.username;
                        $scope.user = result;
                    } else {
                        $scope.status = 'not logged in';
                    }
                    $scope.status_error = false;
                });
            }).fail(function() {
                sa(function() {  $scope.user_logged_in = 'error connecting';  });
            });
        };
        if (get_store()) {
            var store = get_store();
            load_stats(store);
            store.on('disconnect', function() { sa(function() { $scope.status = 'disconnected :('; }); }, guid);
            store.on('login', function() { load_stats(get_store()); }, guid);
            store.on('logout', function() { sa(function() { $scope.status = 'logged out'; }); },guid);
            store.on('error', function(e) { sa(function() { $scope.status = 'error - ' + e.toString(); }); },guid);
        }
        watcher.on('change:store', function(s) {
            console.info('change:store', s);
            if(old_store) { old_store.off(undefined, undefined, guid); }
            if (get_store()) { load_stats(get_store()); }
        }, guid);
        // clean up
        window.onunload=function() {
            get_watcher().off(undefined, undefined, guid);
            if (get_store()) { get_store().off(undefined,undefined,guid); }
        };
        $scope.server_url = localStorage.indx_url;
        $scope.set_server = function(url) {
            console.log('setting server ... ', url);
            localStorage.indx_url = $scope.server_url;
            connect(client,utils).then(function(server, result) {
                console.log('success connecting to new server >> telling watcher');
                get_watcher().set_store(server);
            }).fail(function() {
                sa(function() { $scope.status = 'error connecting ' + e.toString(); });
                console.error('error connecting to new ');
            });
        };
        $scope.box_selection = localStorage.indx_box;
        $scope.set_box = function(boxid) {
            console.log('setting box ', boxid);
            localStorage.indx_box = boxid;
            get_watcher()._load_box();
        };

        // var helper = function() {
        //     var me = arguments.callee;
        //     connect(client,utils).then(function(server, result) {
        //         utils.safeApply($scope, function() {
        //             if (!result.is_authenticated) {
        //                 $scope.status = 'connected but not logged in';
        //                 $scope.status_error = true;
        //                 return setTimeout(function() { console.info('not logged in, trying again '); me(); }, 1000);
        //             }
        //             server.getBoxList().then(function(boxes) { 
        //                 console.log('boxes', boxes);
        //                 utils.safeApply($scope, function() { $scope.boxes = boxes; });
        //             });
        //             // for feedback
        //             server.getBox(getBoxName()).then(function(box) {
        //                 console.log('got box by name ', box);
        //                 box.on('obj-add', function(objid) {
        //                     console.log('new obj - -', objid);
        //                     // if (obj.get('type') && obj.get('type')[0] == OBJ_TYPE) {
        //                     //     box.get_obj(obj)
        //                     // }
        //                 });
        //             });
        //             server.on('disconnect', function() { 
        //                 utils.safeApply($scope, function() { 
        //                     console.info('received ws:disconnect, waiting 10 and reconnecting ');
        //                     $scope.status = 'disconnected ';
        //                     delete $scope.user;
        //                 });
        //                 setTimeout(me, 10000); 
        //             });
        //             server.on('logout', logout);
        //         });
        //     }).fail(function(err) { 
        //         delete $scope.user;
        //         utils.safeApply($scope, function() { $scope.user_logged_in = 'error connecting'; });
        //         setTimeout(function() { console.log('error connecting ', err, 'going again >>'); me(); }, 1000);
        //     });
        // };
        // helper();
    })
    // main controller
    .controller('main', function($scope, watcher, geowatcher, client, utils) {
        // main 
        window.utils = utils;
        var winstance = watcher.init(), n_logged = 0, _timeout, geoinstance = geowatcher.init();
        // var 
        var displayFail = function(reason) { 
            setErrorBadge('x' , reason);
            winstance.setError(reason);
        };
        window.watcher_instance = winstance;
        winstance.on('connection-error', function(e) {  
            displayFail('server error');
            console.error('connection-error', e);
            // disconnect server
            var s = winstance.get('store');
            if (s) { 
                s.disconnect();
                winstance.set_store();
            }

            if (!_timeout) { 
                console.error('scheduling a reconnect ... ');
                _timeout = setTimeout(function() { 
                    console.error('attempting reconnect... ');
                    _timeout = undefined;
                    runner();
                }, 1000);
            }
        });
        winstance.on('new-entries', function(entries) { 
            n_logged += entries.length; setOKBadge(''+n_logged); 
        });
        var initStore = function(store) {
            console.info('connect successful >> ', store);
            window.s = store;
            winstance.set_store(store);
            geoinstance.set_store(store);
            winstance.setError();
            store.on('disconnect', function() {
                displayFail('disconnected from indx');
                console.error('disconnected >> waiting 1 second before reconnection');
            });
            store.on('logout', function() {  displayFail('logged out of indx'); });
        };
        var runner = function() {
            var me = arguments.callee;
            connect(client,utils).then(initStore)
                .fail(function(err) {
                    console.error('connect failure ', err);
                    displayFail(err.toString());
                    console.error('cannot connect -- ', err);
                    setTimeout(me, 10000); 
                });
        };
        runner();
    }).factory('geowatcher', function(utils, client) {
        // plugin that watches for geo changes
        var GeoWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                var this_ = this, err = function(e) { this_.trigger('error', e); };
                navigator.geolocation.watchPosition(function(pos) { this_.trigger('geoevent', pos); }, err);
                navigator.geolocation.getCurrentPosition(function(pos) { this_.trigger('geoevent', pos); },err);
                this.on('geoevent', function() { this_._handle_geo.apply(this_, arguments); });
                this.on('change:current_position', function(pos) { console.info('current position changed', pos); });
                this.on('change:store', function(s) { this_._load_box();  });
                this.on('change:journal', function() { 
                    // we may have been waiting on things, let's try again
                    this_._commit(); 
                });
                this.data = [];
            },
            _load_box:function() {
                var store = this.get('store'), this_ = this;
                if (!getBoxName()) { console.error('geowatcher ~~~ no box specified '); return; }
                if (store && getBoxName()) { 
                    console.info('geowatcher getting box ');
                    store.getBox(getBoxName()).then(function(b) { 
                        this_.set('box', b);
                        b.getObj(GEO_JOURNAL_ID).then(function(jobj) {
                            this_.set('journal',jobj);
                            jobj.save(); // make sure it exists.
                        });
                    });
                }
            },
            set_store:function(s) { 
                this.set("store", s); 
                if (!s) { 
                    this.unset('box');
                }
            },
            _handle_geo:function(raw_pos) {
                // debug >> 
                console.log('_geochange', raw_pos);
                var cur_pos = this.get('current_position'), pos = this._make_record(raw_pos), now = new Date();
                if (cur_pos){
                    cur_pos.end = now;
                    this._commit(cur_pos);
                }
                cur_pos = pos;
                this._commit(cur_pos);
            },
            _make_record:function(pos) {
                var now = (new Date());
                return _({}).extend({start: now, end: now, 
                    latitude: pos.coords.latitude, longitude: pos.coords.longitude,
                    id:"geo-observation-"+utils.guid(), type:GEO_OBJ_TYPE});
            },
            _commit:function(pos) {
                console.info('geowatcher ~~~~ commit!! ', pos);
                var this_ = this, journal = this.get('journal'), box = this.get('box'), data = pos ? this.data.concat([pos]) : this.data;
                if (journal && box) { 
                    data.map(function(pos) {
                        pos = _({journal:journal}).extend(pos);
                        var id = pos.id;
                        delete pos.id;
                        console.info('pos pre is ', pos, " id is ", id);
                        box.getObj(id).then(function(posobj) {
                             posobj.set(pos);
                             posobj.save();
                        }).fail(function(e) { this_.trigger('connection-error', e); });
                    });
                    this_.data = this_.data.slice(data.length);
                } 
                // couldn't write it, so let's queue it
                if (pos && _(pos).keys().length > 0) { 
                    this.data.push(pos);
                }
            }
        });
      return {
            init:function(store) {
                if (!this.watcher) { 
                    this.watcher = new GeoWatcher({store:store});
                }
                return this.watcher;
            },
            set_store:function(store) { 
                if (this.watcher) { this.watcher.set_store(store);   }
            },
            set_enabled:function(enabled) {
                if (this.watcher) { this.watcher.set('enabled', enabled); }
                return false;
            },
            get_enabled:function() {
                if (this.watcher) { return this.watcher.get('enabled'); }
                return false;
            }
        };
    }).factory('watcher', function(utils, client) {
        var WindowWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                console.log('initialise .. ');
                var this_ = this;
                this.data = [];
                this.bind("user-action", function() {  
                    if (this_.get('enabled')) { this_.handle_action.apply(this_, arguments); } 
                });

                // window created
                // created new window, which has grabbed focus
                chrome.windows.onCreated.addListener(function(w) {
                    if (w && w.id) {
                        console.log('on created >> ', w);
                        chrome.tabs.getSelected(w.id, function(tab) { this_.trigger("user-action", { url: tab.url, title: tab.title });  });
                    }
                });
                // removed window, meaning focus lost
                chrome.windows.onRemoved.addListener(function(window) { this_.trigger("user-action", undefined); });

                // window focus changed
                chrome.windows.onFocusChanged.addListener(function(w) {
                    if (w >= 0) {
                        chrome.tabs.getSelected(w, function(tab) {
                            // console.info("window focus-change W:", w, ", tab:", tab, 'tab url', tab.url);
                            this_.trigger("user-action", tab !== undefined ? { url: tab.url, title: tab.title } : undefined);
                        });
                    }
                });
                // tab selection changed
                chrome.tabs.onSelectionChanged.addListener(function(tabid, info, t) {
                    chrome.tabs.getSelected(info.windowId, function(tab) {
                        this_.trigger("user-action", tab !== undefined ? { url: tab.url, title: tab.title } : undefined);
                    });
                });
                // updated a tab 
                chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, tab) {
                    // console.info("tab_updated", t.url, changeinfo.status);
                    if (changeinfo.status == 'loading') { return; }
                    this_.trigger("user-action", { url: tab.url, title: tab.title });
                });

                this._init_history();
                // todo: start it up on current focused window.
                //  ---------------------------------------
            },
            _init_history:function() { 
                // keep history around for plugins etc 
                var this_ = this;
                if (!this._history) { this._history = []; }
                var N = 250, records = this._history, threshold_secs = 0; //.80;
                this.on('new-entries', function(entries) {
                    records = _(records).union(entries).filter(function(d) { return duration_secs(d) > threshold_secs; });
                    records = records.slice(0,N);
                    this.trigger('updated-history', records);
                    this_._history = records;
                });
            },
            _get_history:function() { return this._history || [];  },
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
            _load_box:function() {
                var bid = getBoxName(), store = this.get('store'), d = u.deferred(), this_ = this;
                console.log('load box !! ', bid);
                if (bid && store) {
                    store.getBox(bid).then(function(box) { 
                        this_.box = box;
                        box.getObj(OBJ_ID).then(function(obj) {
                            obj.save(); // make sure journal exists.
                            this_.set('journal', obj);
                            d.resolve(box); 
                        }).fail(d.reject); 
                    }).fail(d.reject);
                } else { 
                    if (!bid) { return d.reject('no box specified'); } 
                    d.reject('no store specified');
                 }
                return d.promise();
            },
            getError: function() {  return this.get('error'); },
            setError: function(e) { this.set("error",e); this.trigger('error-update'); },
            set_store:function(store) {
                console.log('set store > ', store, this.bid);
                this.set({store:store});
                if (!store) { 
                    delete this.box; 
                    this.unset('journal');
                    return;
                };
                // store is defined
                this._load_box();
            },
            handle_action:function(tabinfo) {
                var url = tabinfo && tabinfo.url, title = tabinfo && tabinfo.title;
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
                            // this_.trigger("new-record", this_.current_record);
                        }
                    }
                    // go on to create a new record
                    if (url !== undefined) {
                        this_.current_record = this_.make_record({start: now, end:now, to: url, location: url, title:title});
                        this_.data.push(this_.current_record);
                        this_._record_updated(this_.current_record);
                    }
                });
            },
            make_record:function(options) {
                // console.log("make record >> ", options, options.location);
                return _({}).extend(options, {id:utils.guid(), type:OBJ_TYPE});
            },
            _record_updated:function(current_record) {
                // console.log('record updated ... box ', this.box, current_record);
                var this_ = this, box = this.box, store = this.get('store'), journal = this.get('journal'), data = this.data.concat([current_record]);
                var signalerror = function(e) {  this_.trigger('connection-error', e);       };
                if (store && box && journal && data.length > 0) {
                    var _rec_map = {};
                    var ids = data.map(function(rec) { 
                        var id = "webjournal-log-"+rec.id;
                        _rec_map[id] = rec;
                        return id;
                    });
                    box.getObj(ids).then(function(rec_objs) {
                        rec_objs.map(function(rec_obj) {
                            var src = _({}).extend(_rec_map[rec_obj.id], {collection:journal});
                            delete src.id;
                            rec_obj.set(src);
                            rec_obj.save().fail(function(error) { 
                                // might be obsolete
                                // todo: do something more sensible
                                if (error.status === 409) { 
                                    console.error('got obsolete call .. '); 
                                    return setTimeout(function() { rec_obj.save().fail(signalerror); }, 1000); 
                                }
                                console.error('saving error :: some other error ', error);
                                signalerror(error);
                            });
                        });
                        this_.trigger('new-entries', rec_objs);
                    }).fail(signalerror); 
                    //  journal.save().fail(signalerror);
                    this.data = this.data.slice(data.length);
                }
            }
        });
    return {
        init:function(store) {
            if (!this.watcher) { 
                this.watcher = new WindowWatcher({store:store});
            }
            return this.watcher;
        },
        set_store:function(store) { 
            if (this.watcher) { 
                this.watcher.set('store', store); 
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
