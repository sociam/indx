
(function() {

    var set_up_store = function(client,utils) {
        var server_url = localStorage.indx_url || 'https://indx.local:8211';
        var s = new client.Store({server_host:server_url});
        var d = utils.deferred();
        try {
            s.check_login().then(function(response) { 
                if (response.is_authenticated) { 
                    return d.resolve(s); 
                };
                d.reject('not logged in');
            }).fail(d.reject);
        } catch (e)  { console.error(e); }
        return d.promise();
    };
    angular.module('webjournal', ['indx'])
    .controller('options', function($scope, watcher, client,utils) {
        setInterval(function()  {
               s.check_login().then(function(result) {
                console.log('result', result);
                utils.safe_apply($scope, function() {
                    if (!result.is_authenticated) {
                        return $scope.user_logged_in = 'not logged in';
                    }
                    $scope.user_logged_in = result.name || result.username;
                });
            }).fail(function() { 
                   utils.safe_apply($scope, function() { 
                       $scope.user_logged_in = 'error connecting';
                   });
            });
        }, 1000);
    }).controller('main', function($scope, watcher, client,utils) {
        window.utils = utils;
        var init = function(store) { 
            console.log('success ', store);
            var box = localStorage.indx_box || 'lifelog';
            var winstance = watcher.init(store);
            console.log('setting box ', box);
            try { 
                winstance.set_box(localStorage.indx_box || 'lifelog');
            } catch(e) { console.error(e); }
            console.info("indx webjournal starting up");
        };
        var s = set_up_store(client,utils).then(init).fail(function(err) {
             console.error(' fail on set up store - do it  again')
             // var me = arguments.callee;
             // console.error(err);
             // setTimeout(function() { set_up_store(client,utils).then(init).fail(me); }, 1000);
         });
    }).factory('watcher', function(utils, client) {
        var WindowWatcher = Backbone.Model.extend({
            initialize:function(attributes) {
                console.log('initialise .. ');
                var this_ = this;
                this.data = [];
                this.bind("change", function() { this_.change.apply(this_, arguments); });
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
               console.log(' end initialise .. ');

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
            set_box:function(bid) {
                console.log('attempting to set box >> ', bid);
                var this_=  this, store = this.get('store');
                store.get_box(bid).then(function(b) {  
                    window.b = b;
                    console.info('successfully got box ', bid);
                    this_.box = b;  
                }).fail(function(err) {
                    u.error('error getting box ', bid);
                    delete this_.box;
                });
            },
            change:function(url) {
                var this_ = this;
                if (this.current_record !== undefined) {
                    if (url == this.current_record.location) {
                        this.current_record.end = new Date();
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
                    this.data.push(this.current_record);
                    this._record_updated(this.current_record);
                }
            },
            make_record:function(options) {
                console.log("make record >> ", options);
                return _({}).chain().extend(options).extend({id:utils.guid()}).value();
            },
            _record_updated:function() {
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
            this.watcher = new WindowWatcher({store:store});
            return this.watcher;
        },
        set_polling:function(polling) {
            polling ? this.watcher.start_polling() : this.watcher.end_polling();
        }
    };
    });
}());
