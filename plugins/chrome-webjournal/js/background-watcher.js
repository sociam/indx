/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console, chrome */

(function() { 
    var OBJ_TYPE = localStorage.indx_webjournal_type || 'web-page-view';
    var OBJ_ID = localStorage.indx_webjournal_id || 'my-web-journal';
    var tabthumbs = {};

    var app = angular.module('webjournal').factory('watcher', function(utils, client, entities, pluginUtils, $injector) {
        var u = utils, pu = pluginUtils;

        // window watcher
        var WindowWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                var this_ = this, _fetching = [];
                this._fetching_thumbnail = {};
                this.bind('user-action', function() { this_.handle_action.apply(this_, arguments); });
                var _trigger = function(windowid, tabid, tab) {
                    var _done = function() {
                       this_.trigger('user-action', { url: tab.url, title: tab.title, favicon:tab.favIconUrl, tabid:tab.id, windowid:windowid, thumbnail:tabthumbs[tab.url] });
                    };
                    var _thumbs = function() { 
                        // console.log("_thumbs", tab.url, tab.status, 'already have? ', tabthumbs[tab.url] !== undefined);
                        if (tabthumbs[tab.url]) {  _done(); } 
                        else if (tab.status == 'complete' && !_fetching[tab.url]) {
                            // no thumb, loaded so let's capture
                            // console.log('getting thumb >> ');
                            _fetching[tab.url] = true;
                            this_._getThumbnail(windowid, tab.url).then(function(thumbnail_model) {
                                // console.log('continuation thumb ', thumbnail_model.slice(0,10)); // thumbnail_model.id, _(thumbnail_model.attributes).keys().length);
                                delete _fetching[tab.url];
                                _done();
                            }).fail(function(bail) {  
                                console.error('error with thumbnail, ', bail);  
                            });
                        } else {
                            // loading, let's just start and try again
                            // we don't want to enable this because it will cause an unnecessary save.
                            // _done();
                        }
                    };
                    if (tab) { return _thumbs(); }
                    if (tabid) { 
                        chrome.tabs.get(tabid, function(_tab) { 
                            tab = _tab; 
                            if (tab) { return _thumbs();  }
                            this_.trigger('user-action', undefined);

                        });
                    } else {
                        this_.trigger('user-action', undefined);
                    }
                };
                // window created
                // created new window, which has grabbed focus
                chrome.windows.onCreated.addListener(function(w) {
                    if (w && w.id) {
                        // console.log('window created >> ', w);
                        chrome.tabs.query({windowId:w.id, active:true}, function(tab) { 
                            if (tab) { _trigger(w.id, undefined, tab);  } else { this_.trigger('user-action', undefined); }
                        });
                    }
                });
                // removed window, meaning focus lost
                chrome.windows.onRemoved.addListener(function(window) { this_.trigger('user-action', undefined); });
                // window focus changed
                chrome.windows.onFocusChanged.addListener(function(w) {
                    if (w && w.id) {
                        // console.log('window created >> ', w);
                        chrome.tabs.query({windowId:w.id, active:true}, function(tab) { 
                            if (tab) { _trigger(w.id, undefined, tab);  } else { 
                                this_.trigger('user-action', undefined);  
                            }
                        });
                    }
                });
                // tab selection changed
                chrome.tabs.onActivated.addListener(function(activeInfo) {
                    var tabId = activeInfo.tabId, windowId = activeInfo.windowId;
                    _trigger(windowId, tabId);

                });
                // updated a tab 
                chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, tab) {
                    // console.info('tab_updated', t.url, changeinfo.status);
                    if (changeinfo.status == 'loading') { return; }
                    _trigger(tab.windowId, tabid);
                    // this_.trigger('user-action', { url: tab.url, title: tab.title, tabid: tab.id, favicon:tab.favIconUrl, windowid:window.id });
                });

                this._init_history();   
                // todo: start it up on current focused window.
                //  ---------------------------------------
                this.on('connection-error', function(e) {  
                    pu.setErrorBadge('connection error -- attempting reconnect');
                    this_._attempt_reconnect()
                        .then(function() {  this_._trigger_connection_ok(); })
                        .fail(function() { console.error('getToken failed :( '); });
                });
                window.watcher = this;
            },
            _getThumbnail : function(wid,url) {
                // gets a thumbnail object
                var box = this.box, id = 'thumbnail-' + url, 
                d = u.deferred(), this_ = this;
                if (this._fetching_thumbnail[url]) { 
                    // console.log('already getting thumbnail >> ', url);
                    this._fetching_thumbnail[url].then(function() { d.resolve(tabthumbs[url]);    }).fail(d.reject);
                } else {
                    this._fetching_thumbnail[url] = d;
                    chrome.tabs.captureVisibleTab(wid, { format:'png' }, function(dataUrl) {
                        if (dataUrl) {
                            u.resizeImage(dataUrl, 90, 90).then(function(smallerDataUri) {
                                tabthumbs[url] = smallerDataUri;
                                delete this_._fetching_thumbnail[url];
                                d.resolve(smallerDataUri); 
                            }).fail(function() { console.error('failed resizing '); d.reject(); });
                        } else { 
                            console.log('couldnt get thumbnail -- ', wid, url);
                            d.resolve(); 
                        }
                    });
                }
                return d.promise();
            },
            _attempt_reconnect:function() {
                // very suspicious about this >_< .. TODO look at 
                if (this._timeout !== undefined) { 
                    console.log('timeout is not undefined >> ', this._timeout);
                    return u.when(this._timeout);   
                }
                if (!this.store) { return u.dreject(); }

                var this_ = this, d = u.deferred();
                if (!this.box) { 
                    this_._timeout = d;
                    this._load_box().then(function() { 
                        console.error('thenning loadbox');
                        delete this_._timeout; 
                        d.resolve();
                    }).fail(function() { 
                        console.error('loadbox failing on reconnect');
                        delete this_._timeout; 
                        console.log('this timeout ', this_._timeout)
                        d.reject();
                    });
                    return d.promise();
                }

                console.info('Attempting to refresh tokens ... ');
                this._timeout = d;
                this.box.reconnect().then(function() { 
                    delete this_._timeout;
                    d.resolve();
                }).fail(function() { 
                    delete this_._timeout;
                    console.log('getToken fail and timeout ', this_._timeout);
                    d.reject();
                });
                return d.promise();
            },
            _init_history:function() { 
                // keep history around for plugins etc 
                var this_ = this;
                if (!this._history) { this._history = []; }
                var N = 25, records = this._history, threshold_secs = 0; //.80;
                this.on('new-record', function(record) {
                    console.log('new record >> ', record);
                    if (records.indexOf(record) >= 0) {
                        var old_indx = records.indexOf(record);
                        records.splice(0, 0, records.splice(old_indx,1)[0]);
                    } else {
                        if (pu.duration_secs(record) > threshold_secs) { 
                            records.splice(0, 0, record);
                            records.splice(N);
                            this.trigger('updated-history', records);
                        }
                    }
                });
            },
            _get_history:function() { return this._history || [];  },
            _load_box:function() {
                var bid = pu.getBoxName(), d = u.deferred(), this_ = this, store = this.store;
                // console.log('load box !! ', bid);
                if (bid && store) {
                    store.getBox(bid).then(function(box) {
                        // TODO: need to get username from the box//token
                        box.getObj(OBJ_ID).then(function(jobj) {
                            jQuery.when(jobj.save()).then(function() { 
                                this_.box = box;
                                this_.set('journal', jobj);
                                d.resolve(box); 
                            }).fail(d.reject); 
                        }).fail(d.reject); 
                        // box.getObj([OBJ_ID, store.get('username')]).then(function(objuser) {
                        //     var jobj = objuser[0], whom = objuser[1];
                        //     jQuery.when(jobj.save(), whom.save()).then(function() { 
                        //         this_.box = box;
                        //         this_.set('journal', jobj);
                        //         d.resolve(box); 
                        //     }).fail(d.reject); 
                        // }).fail(d.reject); 
                    }).fail(function(err) { 
                        console.error('_load_box fail getBox(', bid, ')', error);
                        d.reject();
                    });
                } else { 
                    if (!bid) { return d.reject('no box specified'); } 
                    d.reject('no store specified');
                 }
                return d.promise();
            },
            set_store:function(store) {
                var this_ = this;
                this.store = store;
                if (!store) { 
                    delete this.box; 
                    this.unset('journal');
                    return;
                }
                // store is defined
                this._load_box()
                    .then(function(bail) { 
                        this_._trigger_connection_ok(bail); 
                    }).fail(function(bail) { 
                        console.log('set_store load box fail continuation -- ', bail);
                        // this_._trigger_connection_error(bail); 
                    });
            },
            _trigger_connection_ok: function(info) {
                console.info('connection ok ', info);
                this.trigger('connection-ok', info);
            },            
            _trigger_connection_error: function(error) {
                console.error('connection error ', error);
                this.trigger('connection-error', error);
            },
            handle_action:function(tabinfo) {
                var url = tabinfo && tabinfo.url, title = tabinfo && tabinfo.title, this_ = this;
                // if (tabinfo.favicon) { console.log('FAVICON ', tabinfo.favicon); }
                setTimeout(function() { 
                    var now = new Date();
                    if (this_.current_record !== undefined && this_.current_record.peek('what') && url == this_.current_record.peek('what').id) {
                        console.info('updating existing >>>>>>>>>>> ', this_.current_record.peek('what').id);
                        this_.current_record.set({tend:now});
                        this_.current_record.peek('what').set(tabinfo);
                        this_._record_updated(this_.current_record).fail(function(bail) { 
                            this_._trigger_connection_error('error on save current_record');
                        });
                    } else if (tabinfo) {
                        // different now
                        console.info('new record!');
                        if (this_.current_record) {
                            // finalise last one
                            this_.current_record.set({tend:now});
                            // console.info('last record had ', this_.current_record.peek('tend') - this_.current_record.peek('tstart'));
                            this_._record_updated(this_.current_record).fail(function(bail) { 
                                this_._trigger_connection_error('error on save record');
                            });
                            this_.trigger('new-record', this_.current_record);
                        }
                        delete this_.current_record;
                        if (tabinfo) {
                            this_.make_record(now, now, url, title, tabinfo).then(function(record) {
                                this_.current_record = record;
                                this_.trigger('new-record', record);
                                this_._trigger_connection_ok();
                            }).fail(function(x) { 
                                console.error(' error on _make_record >> ', x);
                                this_._trigger_connection_error('error on make record');
                            });
                        }
                    }
                });
            },
            make_record:function(tstart, tend, url, title, tabinfo) {
                // console.log('make record >> ', options, options.location);

                if (!this.box) { return u.dreject(); }
                var geowatcher = $injector.get('geowatcher'), d = u.deferred(), this_ = this;
                this.getDoc(url,title,tabinfo).then(function(docmodel) { 
                    entities.activities.make1(this_.box, 
                      'browse',
                      this.whom, tstart, tend,
                      undefined, undefined, undefined,
                      geowatcher.watcher && geowatcher.watcher.get('current_position'), 
                      { what: docmodel }).then(d.resolve).fail(d.reject);
                }).fail(d.reject);
                return d.promise();
            },
            getDoc:function(url,title,tabinfo) {
                var d = u.deferred(), this_ = this;
                entities.documents.getWebPage(this.box, url).then(function(results) {
                    if (results && results.length) { 
                        // console.log('updating page > and saving', results[0].id, tabinfo);
                        if ( (!results[0].peek('thumbnail') && tabinfo.thumbnail) || 
                             (!results[0].peek('favicon') && tabinfo.favicon) ) { 
                            results[0].set(tabinfo); 
                            return results[0].save().then(function() { d.resolve(results[0]); }).fail(d.reject);
                        }
                        return d.resolve(results[0]).fail(d.reject);
                    }
                    entities.documents.makeWebPage(this_.box, url, title, tabinfo).then(d.resolve).fail(d.reject);
                }).fail(d.reject);
                return d.promise();
            },
            _record_updated:function() {
                // console.log('record updated ... box ', this.box, current_record);
                var this_ = this, box = this.box, store = this.get('store'), journal = this.get('journal'), 
                    current_record = this.current_record;
                if (current_record) { 
                    return u.when( current_record.save(), current_record.peek('what').save() );
                } 
                return u.dresolve();
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
                if (this.watcher) { this.watcher.set_store(store); }
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
    });
})();