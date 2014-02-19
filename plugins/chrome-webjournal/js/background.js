/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, chrome, console */

(function() {
    var server;
    var DEFAULT_URL = 'https://indx.local:8211';
    var GEO_ENABLE = false;

    localStorage.indx_url = localStorage.indx_url || DEFAULT_URL;

    var setErrorBadge = function(errtext) {
        chrome.browserAction.setBadgeText({text:'x'});
        // chrome.browserAction.setBadgeText({text:''+errtext});
        chrome.browserAction.setBadgeBackgroundColor({color:'#ff0000'});
    };
    var clearBadge = function() {
        chrome.browserAction.setBadgeText({text:''});
    };
    var setOKBadge = function(s) {
        chrome.browserAction.setBadgeText({text:s.toString()});
        chrome.browserAction.setBadgeBackgroundColor({color:'#00ffff'});
    };
    var duration_secs = function(d) { 
        return (d.peek('tend') && d.peek('tend').valueOf() - d.peek('tstart') && d.peek('tstart').valueOf()) / 1000.0;  
    };
    var getBoxName = function() { 
        return localStorage.indx_box || 'lifelog'; 
    };

    var get_watcher = function() { return chrome.extension.getBackgroundPage().watcher_instance; };
    var get_store = function() { var w = get_watcher(); if (w) { return w.get('store'); } };

    var make_store = function(client,utils) {
        var server_url = localStorage.indx_url;
        if (server === undefined) {
            server = new client.Store({server_host:server_url});
        }
        if (server.get('server_host') !== server_url) { 
            server.set('server_host', server_url); 
        }
        return server;

        // var d = utils.deferred();
        // server.checkLogin().then(function(response) {
        //     if (response.is_authenticated) { 
        //         setOKBadge(':)');
        //         return d.resolve(server, response);  
        //     }
        //     d.reject('not logged in');
        // }).fail(d.reject);
        // return d.promise();
    };

    // declare modules -----------------|
    var app = angular.module('webjournal', ['indx'])
        .config(function($compileProvider){ 
            $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|data|mailto|file|chrome-extension):/); 
        }).config(function($sceProvider) {
            // Completely disable SCE - options iframe interference
            $sceProvider.enabled(false);
        }).factory('pluginUtils', function() { 
            return {
                setErrorBadge:setErrorBadge,
                setOKBadge:setOKBadge,
                getBoxName:getBoxName,
                duration_secs:duration_secs,
                clearBadge:clearBadge
            };
        }).controller('popup', function($scope, watcher, utils) {
            window.$s = $scope;
            var records = [];
            var guid = utils.guid();
            // scope methods for rendering things nicely.
            $scope.date = function(d) { return new Date().toLocaleTimeString().slice(0,-3);  };
            $scope.duration = function(d) {
                var secs = duration_secs(d);
                if (secs < 60) {  return secs.toFixed(2) + 's'; }  
                return (secs/60.0).toFixed(2) + 'm';
            };    
            var thumbs = [];    
            $scope.thumb = function(d) {
                var what = d && d.peek('what');
                return what.peek('thumbnail');
            };
            $scope.label = function(d) { 
                var maxlen = 150;
                var what = d && d.peek('what');
                if (!what) { return ''; }
                if (what.peek('title') && what.peek('title').length && what.peek('title').trim().length > 0) { 
                    return what.peek('title').slice(0,maxlen); 
                }
                var url = what.id;
                if (!url) { return ''; }
                var noprot = url.slice(url.indexOf('//')+2);
                if (noprot.indexOf('www.') === 0) { noprot = noprot.slice(4); }
                return noprot.slice(0,maxlen);
            };
            var update_history = function(history) {  
                // console.log('update history >> ', history, history.length );
                if (history) { 
                    window.hh = utils.dict(history.map(function(h) { 
                        return [h.peek('what').id, h.peek('what').peek('thumbnail')]; 
                    }));
                }
                utils.safeApply($scope, function() { $scope.data = history.concat(); });     
            };
            get_watcher().on('updated-history', function(history) {  update_history(history); }, guid);
            update_history(get_watcher()._get_history());
            window.onunload=function() { get_watcher().off(undefined, undefined, guid);  };
        }).controller('options', function($scope, client, utils) {
            // options screen only  -------------------------------------------
            var watcher = get_watcher(), guid = utils.guid(), old_store = get_store();
            var sa = function(f) { utils.safeApply($scope, f); };
            window.$s = $scope;
            var load_stats = function(store) {
                store.getBoxList().then(function(boxes) {  sa(function() { $scope.boxes = boxes; });   });
                $scope.user = store.get('username');
                $scope.memuse = watcher._box._getCacheSize();
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
                get_watcher().set_store(make_store(client,utils));
            };
            $scope.box_selection = localStorage.indx_box;
            $scope.set_box = function(boxid) {
                console.log('setting box ', boxid);
                localStorage.indx_box = boxid;
                get_watcher()._load_box();
            };
            // debug only
            setInterval(function() { 
                sa(function() { 
                    $scope.thumbs = _(chrome.extension.getBackgroundPage().tt).clone(); 
                });
            }, 1000);
    }).controller('background', function($scope, watcher, geowatcher, client, utils, entities) {
        // main -------------->
        // background page
        window.utils = utils;
        var winstance = watcher.init(), n_logged = 0, geoinstance = GEO_ENABLE && geowatcher.init();
        var store = make_store(client,utils);
        // 
        var displayFail = function(reason) { 
            setErrorBadge('x' , reason);
            winstance.setError(reason);
        };
        winstance.on('new-entries', function(entries) { 
            n_logged += entries.length; 
            setOKBadge(''+n_logged);  
        });
        winstance.on('connection-error', function() { setErrorBadge('Error');  });
        winstance.on('connection-ok', function() { setOKBadge(':)');  });
        window.watcher_instance = winstance;    
        winstance.set_store(store);              
        window.store = store;
    });
}());
