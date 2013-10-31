
(function() {
    angular.module('webjournal', ['indx'])
    .controller('main', function($scope, watcher, client) {
        console.info("indx webjournal starting up");
        var server_url = 'http://localhost:8211';
        var s = new client.Store(undefined, {server_host:server_url});
        console.log('store ', s.get('server_host'), ' -- looking for box lifelog');
        window.watcher = watcher;
        watcher.init();
        s.get_box('lifelog').then(function(box) {
            window.b = box;
            console.info('Got box ', box);
            watcher.set_box('box');
        }).fail(function(err) {
            console.error('error getting box lifelog ', err);
        });
    }).factory('watcher', function(utils, client) {
        var WindowWatcher = Backbone.Model.extend({
            initialize:function() {
                var this_ = this;
                this.data = new Activities();
                this.bind("change", function() { this_.change.apply(this_, arguments); });
                // created
                chrome.windows.onCreated.addListener(function(window) {
                    chrome.tabs.getSelected(window, function(tab) {
                        this_.trigger("change", tab.url);
                    });
                });
                // focus changed
                chrome.windows.onFocusChanged.addListener(function(window) {
                    chrome.tabs.getSelected(window, function(tab) {
                        console.log("focus-change ", window, ", tab ", tab);
                        this_.trigger("change", tab !== undefined ? tab.url : undefined);
                    });
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
                set_box(localStorage.storeName || 'webwatcher');
            },
            start_polling:function(interval) {
                var this_ = this;
                this.stop_polling();
                this_.poll = setInterval(function() {
                    if (this_.current_record !== undefined) {
                        this_.change(this_.current_record.get("location"));
                    }
                }, interval || 1000);
            },
            stop_polling:function() {
                if (this.poll) {
                    clearInterval(this.poll);
                    delete this.poll;
                }
            },
            set_box:function(bid) {
                var this_=  this;
                store.get_box(bid).then(function(b) {  this_.box = bid;  }).fail(function(err) {
                    u.error('error getting box ', bid);
                    delete this_.box;
                });
            },
            change:function(url) {
                var this_ = this;
                if (this.current_record !== undefined) {
                    if (url == this.current_record.get("location")) {
                        this.current_record.set({end:new Date()});
                        this._record_updated(this.current_record);
                        this.trigger("update_record", this.current_record);
                        return;
                    }
                    // different now
                    delete this.current_record;
                    this.trigger("new_record", this.current_record);
                }
                // go on to create a new record
                if (url !== undefined) {
                    var now = new Date();
                    this.current_record = this.make_record({start: now, end:now, to: url, location: url});
                    // this.data.add(this.current_record);
                    this._record_updated(this.current_record);
                }
            },
            make_record:function(options) {
                if (options.id === undefined) { options.id = util.guid(); }
                return new Activity(options);
            },
            _record_updated:function() {
                if (this.box !== undefined && this.current_record !== undefined) {
                    var id = "webjournal-log-"+this.current_record.id;
                    var rec = this.current_record;
                    box.get_obj(id).then(function(obj) {
                        obj.set({
                            start: current_record.get('start'),
                            end:current_record.get('end'),
                            location:current_record.get('location')
                        }); 
                        obj.save().then(function() { u.log('webjournal saved ', obj.id); }).fail(function(err) { u.error('webjournal save fail '); });
                    });
                }
            }
        });
    return {
        init:function() {
            this.watcher = new WindowWatcher();
        },
        set_box:function(b) {
            this.watcher.set_box(b);
        },
        set_polling:function(polling) {
            polling ? this.watcher.start_polling() : this.watcher.end_polling();
        }
    };
    });
}());
