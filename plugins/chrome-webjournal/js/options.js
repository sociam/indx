/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, chrome, console */

(function() { 
    angular.module('webjournal')
        .controller('options', function($scope, client, utils, pluginUtils) {
            // options screen only  -------------------------------------------
            var pu = pluginUtils,
                watcher = pu.get_watcher(), 
                guid = utils.guid(), 
                old_store = pu.get_store(),
                sa = function(f) { utils.safeApply($scope, f); };

            var logged_dudes = [];
            $scope.durations = [];

            // store-related
            var update_boxes = function(store) {
                store.getBoxList().then(function(boxes) {  
                    console.log('getting boxes >> ', boxes);
                    sa(function() { $scope.boxes = boxes; });   
                }).fail(function(bail) { 
                    console.log('fail getting boxes ' );
                    sa(function() { delete $scope.boxes; });   
                });
            }, update_user = function(store) {
                store.checkLogin().then(function(x) { 
                    sa(function() { $scope.user = x; });  
                });
            };

            // box related
            var update_token = function(b) {
                sa(function() { $scope.token = b._getCachedToken() || b._getStoredToken(); });
            }, update_memuse = function(b) { 
                sa(function() {  $scope.memuse = b.getCacheSize(); }); 
            }, set_box = function(b) {
                var date = function(vd) { return new Date(vd['@value']);  };
                b.query({activity:'browse'}, ['tstart', 'tend', 'what']).then(function(x) {
                    console.log('browse result >>', x);
                    $scope.durations = _(x.data).map(function(activity,id) { 
                        if (!activity.tend || !activity.tstart) { return 0; }
                        var tstart = date(activity.tstart[0]).valueOf();
                        return [tstart, date(activity.tend[0]).valueOf() - tstart];
                    });
                    $scope.durations.sort(function(a,b){ return b[0] - a[0]; });
                    console.log('durations >> ', $scope.durations);
                    sa(function() { 
                        $scope.base_browse_count = _(x.data).size(); 
                        $scope.browse_count = $scope.base_browse_count + logged_dudes.length;
                    });
                });
                b.off(undefined,undefined,guid);
                b.on('obj-add', function(obj) { update_memuse(b); }, guid);
                b.on('new-token', function() { update_token(b); }, guid);
                sa(function() { 
                    $scope.box = b;
                    update_token(b);
                    update_memuse(b);
                });
            };
            var set_store = function(store) {
                console.log('getting boxlist -- ', store);
                update_boxes(store);
                update_user(store);           
            };

            // cleanup
            window.onunload=function() { 
                pu.get_watcher().off(undefined, undefined, guid); 
                var b = pu.get_watcher().get_box();
                if (b) { b.off(undefined, undefined, guid); }
            };  

            // set some initial values
            $scope.server_url = localStorage.indx_url;
            $scope.box_selection = localStorage.indx_box;

            // form -> server
            $scope.set_server = function(url) {
                console.log('setting server ... ', url);
                if (watcher.get_box()) { 
                    watcher.get_box().off(undefined, undefined, guid);
                }
                sa(function() { 
                    delete $scope.browse_count;
                    logged_dudes = [];
                });                
                localStorage.indx_url = $scope.server_url;
                var store = pu.make_store(client,utils);
                pu.get_watcher().set_store(store);
            };
            // form box -> box selection
            $scope.$watch('box_selection', function() {
                var boxid = $scope.box_selection;
                if (boxid && boxid !== localStorage.indx_box) {
                    console.log('setting box ', boxid);
                    localStorage.indx_box = boxid;
                    pu.get_watcher()._load_box();
                }
            });
            // register core watcher events
            watcher.on('change:store', function(store) {   
                console.log('change:store', store);
                set_store(store);  
            }, guid);
            watcher.on('change:box', function(b) {  
                if (watcher.get_box()) { 
                    set_box(watcher.get_box());  
                }
            },guid);
            watcher.on('new-record', function(record) { 
                console.log('new record >>>>>> ', record);
                sa(function() { 
                    if (logged_dudes.indexOf(record) < 0) { logged_dudes.push(record); }
                    $scope.browse_count = $scope.base_browse_count + logged_dudes.length;
                });
            });

            var update_history = function() {
                $scope.history = watcher._get_history().concat(); 
                $scope.thumbs = _(chrome.extension.getBackgroundPage().tt).clone();
            };
            watcher.on('updated-history', update_history);

            // first startup....
            set_store(pu.make_store(client,utils));
            if (watcher.get_box()) { 
                set_box(watcher.get_box()); 
                update_history();
            }

            window.watcher = pu.get_watcher();
            window.$s = $scope;
    });
})();