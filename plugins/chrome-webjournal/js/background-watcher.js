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
                var this_ = this;
                this.bind('user-action', function() { this_.handle_action.apply(this_, arguments); });
                var _trigger = function(windowid, tabid, tab) {
                        var _done = function() {
                           this_.trigger('user-action', { url: tab.url, title: tab.title, favicon:tab.favIconUrl, tabid:tab.id, windowid:windowid, thumbnail:tabthumbs[tab.url] });
                        };
                        var _thumbs = function() { 
                            if (tabthumbs[tab.url]) { 
                                _done(); 
                            } else if (tab.status == 'complete') {
                                // no thumb, loaded so let's capture
                                console.log("capturing visible tab >> ");
                                chrome.tabs.captureVisibleTab(undefined, { format:'jpeg', quality:1 }, function(dataUrl) {
                                    console.log('got a thumbnail for ', tab.url, dataUrl);
                                    tabthumbs[tab.url] = dataUrl;  // encodeURIComponent(dataUrl);
                                    _done();
                                });
                            } else {
                                // loading, let's just start and try again
                                _done();
                            }
                        };
                        if (tab) { return _thumbs(); }
                        chrome.tabs.get(tabid, function(_tab) { tab = _tab; _thumbs(); });
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
                    pu.setErrorBadge(':(');
                    console.error('connection-error', e);
                    this_._attempt_reconnect();
                    // ignore.
                });
                window.watcher = this;
            },
            _attempt_reconnect:function() {
                // very suspicious about this >_< .. TODO look at 
                var this_ = this;
                if (this_.box && !this_._timeout) { 
                    console.info('Attempting to refresh tokens ... ');
                    var do_refresh = function() { 
                        var b = this_.box;
                        if (!b) { return; }
                        b.reconnect().then(function() {  delete this_._timeout;  console.info('box refresh ok!');  })
                        .fail(function(e) {
                            console.error('box refresh fail :( ');
                            console.error('scheduling a refresh ... ');
                            delete this_._timeout;
                            this_._timeout = setTimeout(function() {
                                console.error('attempting refresh ... ');
                                do_refresh();
                            }, 1000);
                        });
                    };
                    do_refresh();
                }
            },
            _init_history:function() { 
                // keep history around for plugins etc 
                var this_ = this;
                if (!this._history) { this._history = []; }
                var N = 25, records = this._history, threshold_secs = 0; //.80;
                this.on('new-entries', function(entries) {
                    var longies = entries.filter(function(d) { return pu.duration_secs(d) > threshold_secs; });
                    records = _(records).union(longies);
                    records = records.slice(-N);
                    this.trigger('updated-history', records);
                    this_._history = records;
                });
            },
            _get_history:function() { return this._history || [];  },
            // start_polling:function(interval) {
            //     var this_ = this;
            //     this.stop_polling();
            //     this_.poll = setInterval(function() {
            //         if (this_.current_record !== undefined) {
            //             this_.change(this_.current_record.location);
            //         }
            //     }, 1000);
            // },
            // stop_polling:function() {
            //     if (this.poll) {
            //         clearInterval(this.poll);
            //         delete this.poll;
            //     }
            // },
            _load_box:function() {
                var bid = pu.getBoxName(), store = this.get('store'), d = u.deferred(), this_ = this;
                console.log('load box !! ', bid);
                if (bid && store) {
                    store.getBox(bid).then(function(box) { 
                        var dbox = u.deferred(), dwho = u.deferred();
                        this_.box = box;
                        box.getObj(OBJ_ID).then(function(obj) {
                            obj.save(); // make sure journal exists.
                            this_.set('journal', obj);
                            dbox.resolve(box); 
                        }).fail(d.reject); 
                        box.getObj(store.get('username')).then(function(userobj) {
                            this_.whom = userobj;
                            dwho.resolve(userobj);
                        });                        
                        jQuery.when(dbox, dwho).then(d.resolve).fail(d.reject);
                    }).fail(d.reject);
                } else { 
                    if (!bid) { return d.reject('no box specified'); } 
                    d.reject('no store specified');
                 }
                return d.promise();
            },
            getError: function() {  return this.get('error'); },
            setError: function(e) { this.set('error',e); this.trigger('error-update'); },
            set_store:function(store) {
                var this_ = this;
                console.log('set store > ', store, this.bid);
                this.set({store:store});
                if (!store) { 
                    delete this.box; 
                    this.unset('journal');
                    return;
                }
                // store is defined
                this._load_box().fail(function(bail) { this_.trigger('connection-error', bail); });
            },
            handle_action:function(tabinfo) {
                var url = tabinfo && tabinfo.url, title = tabinfo && tabinfo.title, this_ = this;
                // if (tabinfo.favicon) { console.log('FAVICON ', tabinfo.favicon); }
                setTimeout(function() { 
                    var now = new Date();
                    if (this_.current_record !== undefined && this_.current_record.peek('what') && url == this_.current_record.peek('what').id) {
                        console.info('updating existing >>>>>>>>>>> ', this_.current_record.peek('what').id);
                        this_.current_record.set({tend:now});
                        this_.current_record.set(tabinfo);
                        this_._record_updated(this_.current_record).fail(function(bail) { 
                            console.error('error on save >> ', bail);
                            this_.trigger('connection-error', bail);
                        });
                    } else if (tabinfo) {
                        // different now
                        console.info('new record!');
                        if (this_.current_record) {
                            // finalise last one
                            this_.current_record.set({tend:now});
                            // console.info('last record had ', this_.current_record.peek('tend') - this_.current_record.peek('tstart'));
                            this_._record_updated(this_.current_record).fail(function(bail) { 
                                console.error('error on save >> ', bail);
                                this_.trigger('connection-error', bail);
                            });
                        }
                        delete this_.current_record;
                        if (tabinfo) {
                            this_.make_record(now, now, url, title, tabinfo).then(function(record) {
                                this_.current_record = record;
                                this_.trigger('new-record', record);
                            }).fail(function(x) { 
                                console.error(' error on _make_record >> ', x);
                                this_.trigger('connection-error', x);
                            });
                        }
                    }
                });
            },
            make_record:function(tstart, tend, url, title, tabinfo) {
                // console.log('make record >> ', options, options.location);
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
                    if (results && results.length) { return d.resolve(results[0]);  }
                    return entities.documents.makeWebPage(this_.box, url, title, tabinfo);
                }).fail(d.reject);
                return d.promise();
            },
            _record_updated:function() {
                // console.log('record updated ... box ', this.box, current_record);

                var this_ = this, box = this.box, store = this.get('store'), journal = this.get('journal'), 
                    current_record = this.current_record;

                if (current_record) { return current_record.save(); } 
                return u.dresolve();

                // var signalerror = function(e) {  
                //     this_.trigger('connection-error', e);   
                // };
                // if (store && box && journal && data.length > 0) {
                //     var _rec_map = {};
                //     var ids = data.map(function(rec) { 
                //         var id = 'webjournal-log-'+rec.id;
                //         _rec_map[id] = rec;
                //         return id;
                //     });
                //     ids = utils.uniqstr(ids);
                //     box.getObj(ids).then(function(rec_objs) {
                //         rec_objs.map(function(rec_obj) {
                //             var src = _({}).extend(_rec_map[rec_obj.id], {collection:journal});
                //             delete src.id;
                //             rec_obj.set(src);
                //             rec_obj.save().fail(function(error) { 
                //                 // might be obsolete
                //                 // todo: do something more sensible
                //                 if (error.status === 409) { 
                //                     console.error('got obsolete call .. '); 
                //                     return setTimeout(function() { rec_obj.save().fail(signalerror); }, 1000); 
                //                 }
                //                 console.error('saving error :: some other error ', error);
                //                 signalerror(error);
                //             });
                //         });
                //         this_.trigger('new-entries', rec_objs);
                //     }).fail(signalerror); 
                //     //  journal.save().fail(signalerror);
                //     this.data = this.data.slice(data.length);
                // }
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
            }
            // set_polling:function(polling) {
            //     if (polling) { 
            //         this.watcher.start_polling();
            //     } else {
            //        this.watcher.end_polling();
            //     }
            // }
        };
    });
})();