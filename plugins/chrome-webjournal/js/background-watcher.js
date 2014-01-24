/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console, chrome */

(function() { 
    var OBJ_TYPE = localStorage.indx_webjournal_type || 'web-page-view';
    var OBJ_ID = localStorage.indx_webjournal_id || 'my-web-journal';

    var app = angular.module('webjournal').factory('watcher', function(utils, client, pluginUtils) {
        var u = utils, pu = pluginUtils;
        // window watcher
        var WindowWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                console.log('initialise watcher --');
                var this_ = this;
                this.data = [];
                this.bind('user-action', function() {  if (this_.get('enabled')) { this_.handle_action.apply(this_, arguments); }  });

                // window created
                // created new window, which has grabbed focus
                chrome.windows.onCreated.addListener(function(w) {
                    if (w && w.id) {
                        console.log('on created >> ', w);
                        chrome.tabs.getSelected(w.id, function(tab) { this_.trigger('user-action', { url: tab.url, title: tab.title, favicon:tab.favIconUrl, tabid: tab.id, windowid:w.id });  });
                    }
                });
                // removed window, meaning focus lost
                chrome.windows.onRemoved.addListener(function(window) { this_.trigger('user-action', undefined); });

                // window focus changed
                chrome.windows.onFocusChanged.addListener(function(w) {
                    if (w >= 0) {
                        chrome.tabs.getSelected(w, function(tab) {
                            // console.info('window focus-change W:', w, ', tab:', tab, 'tab url', tab.url);
                            this_.trigger('user-action', tab !== undefined ? { url: tab.url, title: tab.title, favicon:tab.favIconUrl, tabid: tab.id, windowid:w.id } : undefined);
                        });
                    }
                });
                // tab selection changed
                chrome.tabs.onSelectionChanged.addListener(function(tabid, info, t) {
                    chrome.tabs.getSelected(info.windowId, function(tab) {
                        this_.trigger('user-action', tab !== undefined ? { url: tab.url, title: tab.title, favicon:tab.favIconUrl, tabid:tab.id, windowid:info.windowId } : undefined);
                    });
                });
                // updated a tab 
                chrome.tabs.onUpdated.addListener(function(tabid, changeinfo, tab) {
                    // console.info('tab_updated', t.url, changeinfo.status);
                    if (changeinfo.status == 'loading') { return; }
                    this_.trigger('user-action', { url: tab.url, title: tab.title, tabid: tab.id, favicon:tab.favIconUrl, windowid:window.id });
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
            },
            _attempt_reconnect:function() {
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
                var bid = pu.getBoxName(), store = this.get('store'), d = u.deferred(), this_ = this;
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
            setError: function(e) { this.set('error',e); this.trigger('error-update'); },
            set_store:function(store) {
                console.log('set store > ', store, this.bid);
                this.set({store:store});
                if (!store) { 
                    delete this.box; 
                    this.unset('journal');
                    return;
                }
                // store is defined
                this._load_box();
            },
            handle_action:function(tabinfo) {
                var url = tabinfo && tabinfo.url, title = tabinfo && tabinfo.title;
                if (tabinfo.favicon) { console.log('FAVICON ', tabinfo.favicon); }
                var this_ = this;
                setTimeout(function() { 
                    var now = new Date();
                    if (this_.current_record !== undefined) {
                        this_.current_record.end = now;
                        this_._record_updated(this_.current_record);
                        if (url === this_.current_record.location) { 
                            _(this_.current_record).extend(tabinfo);
                            // we're done
                            // console.info('just updated, returning');
                            return;
                        } else {
                            // different now
                            // console.log('new record!');
                            delete this_.current_record;
                            // this_.trigger('new-record', this_.current_record);
                        }
                    }
                    // go on to create a new record
                    if (url !== undefined) {
                        this_.current_record = this_.make_record(_({start: now, end:now, to: url, location: url, title:title}).extend(tabinfo));
                        this_.data.push(this_.current_record);
                        this_._record_updated(this_.current_record);
                    }
                });
            },
            make_record:function(options) {
                // console.log('make record >> ', options, options.location);
                return _({}).extend(options, {id:utils.guid(), type:OBJ_TYPE});
            },
            _record_updated:function(current_record) {
                // console.log('record updated ... box ', this.box, current_record);
                var this_ = this, box = this.box, store = this.get('store'), journal = this.get('journal'), data = this.data.concat([current_record]);
                var signalerror = function(e) {  
                    this_.trigger('connection-error', e);   
                };
                if (store && box && journal && data.length > 0) {
                    var _rec_map = {};
                    var ids = data.map(function(rec) { 
                        var id = 'webjournal-log-'+rec.id;
                        _rec_map[id] = rec;
                        return id;
                    });
                    ids = utils.uniqstr(ids);
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
            if (polling) { 
                this.watcher.start_polling();
            } else {
               this.watcher.end_polling();
            }
        }
    };
})();