angular
    .module('FitbitHarvester', ['ui','indx'])
    .controller('ConfigPage', function($scope, client, utils) {
        var u = utils, s = client.store, sa = function(f) { utils.safeApply($scope, f); };
        window.$s = $scope;
        var config;

        if ( !Date.prototype.toISOString ) {
            ( function() {
    
            function pad(number) {
                var r = String(number);
                if ( r.length === 1 ) {
                    r = '0' + r;
                }
                return r;
            }
         
            Date.prototype.toISOString = function() {
                return this.getUTCFullYear()
                    + '-' + pad( this.getUTCMonth() + 1 )
                    + '-' + pad( this.getUTCDate() )
                    + 'T' + pad( this.getUTCHours() )
                    + ':' + pad( this.getUTCMinutes() )
                    + ':' + pad( this.getUTCSeconds() )
                    + '.' + String( (this.getUTCMilliseconds()/1000).toFixed(3) ).slice( 2, 5 )
                    + 'Z';
            };
            }() );
        }

        var status = function(stat) {
            sa(function() { $scope.status = stat; });
        };

        var getConfigFromService = function() {
            s._ajax('GET', 'apps/fitbit/api/get_config').then(function(x) { 
                console.log(x.config);
                var config = x.config;
                // var config = JSON.parse(x.config);
                if (config.fitbit) {
                    if (config.fitbit.token) {
                        sa(function() { 
                            _($scope).extend({ 
                                token: config.fitbit.token
                            });
                        });
                    } else if (config.fitbit.url) {
                        sa(function() { 
                            _($scope).extend({ 
                                url: config.fitbit.url,
                                req_token: config.fitbit.req_token
                            });
                        });
                    }
                }
                if (config.harvester) {
                    sa(function() { 
                        _($scope).extend({ 
                            password: config.harvester.password,
                            box: config.harvester.box, 
                            start: config.harvester.start,
                            frequency: config.harvester.frequency
                        });
                    });
                    if (config.harvester.user && $scope.users) { 
                        var match = $scope.users.filter(function(u) { return u['@id'] === config.harvester.user; });
                        if (match.length) {
                            console.log('match ', match[0]);
                            window.match = match[0];
                            sa(function() { $scope.user = match[0]; });
                        }
                    }
                }
                console.log($scope);
            }).fail(function(err) { 
                console.error('could not get config ', err);    
            });
        };

        var getUsersAndBoxes = function() { 
            var dul = u.deferred(), dbl = u.deferred();
            // get the users
            s.getUserList().then(function(users) {
                console.log('users >> ', users);
                window.users = users;
                sa(function() { $scope.users = users.filter(function(f) { return f.type.indexOf('local') >= 0; });  });
                dul.resolve();
            }).fail(function(e) {
                sa(function() { $scope.status = 'error getting user list'; });
                console.error(e);
                dul.reject();
            });

                // get the boxes
            s.getBoxList().then(function(boxes) { 
                sa(function() { $scope.boxes = boxes; });
                dbl.resolve();
            }).fail(function(e) {
                sa(function() { $scope.status = 'error getting box list'; });
                console.error(e);
                dbl.reject();
            });
            return u.when([dul, dbl]);
        };
        $scope.grantACL = function(user,box) {
            console.log('grantacl -- ', user, box);
            s.getBox(box).then(function(b) { 
                console.log('got box ', b.id);
                b.setACL(user["@id"],{read:true,write:true}).then(function() {
                    sa(function() { $scope.granted = true; $scope.granted_status = 'Success granting ' + user.name + " access to " + box; });
                }).fail(function(e) {
                    sa(function() { $scope.granted = true; $scope.granted_status = 'Error setting ACL ' + e.toString(); });
                });
            });
        };
        $scope.setConfig = function(config) { 
            console.info('i got a config ', config);
            s._ajax('GET', 'apps/fitbit/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
                console.log('success ', x);
                status('configuration chage committed');
                window.retval = x;
            }).fail(function(e) {
                console.error(e);
                status('error committing change ' + e.toString());
            });
        };

        $scope.doStart = function() {
            s._ajax('GET', 'apps/fitbit/api/start').then(function(x) { 
                console.info('App doStart result: ', x); 
                status('Start command successful'); 
            }).fail(function(x) { status(' Error ' + x.toString()); });
        };
        $scope.doStop = function() {
            console.log('App doStop');
            s._ajax('GET', 'apps/fitbit/api/stop')
            .then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
            .fail(function(x) { status(' Error ' + x.toString()); });
        };
        setInterval(function() { 
            s._ajax('GET','apps/fitbit/api/is_running').then(function(r) { 
                sa(function() { 
                    $scope.runstate = r.running ? 'Running' : 'Stopped';  
                });
            }).fail(function(r) {
                sa(function() { $scope.runstate = 'Unknown'; });
            });
        }, 1000);

        // var initialise = function() {
        //     $("#step-text").hide();
        //     $("#step-authurl").hide();
        //     $("#step-pin").hide();
        //     $("#step-btn-pin").hide();
        //     $("#step-btn-download").hide();
        //     $("#step-load").hide();
        // }

        // var checkConfig = function() {
        //     if (!box) { u.debug('no box, skipping '); return ;}
        //     console.log("check if previously authorised, and downloads");
        //     $("#step-load").show();
        //     box.getObj('fitbitConfig').then(function (conf) {
        //         config = conf;
        //         console.log('found config >> ', config);
        //         if (!config.get("authToken")) {
        //             authoriseApp();
        //         } else {
        //             console.log(config.get("authToken")[0]);
        //             setToken(config.get("authToken")[0]);
        //         }
        //     }).fail(function(e) {
        //         u.error('error ', e);
        //     });
        // };

        // var authoriseApp = function() {
        //     $("#step-text").text("The first step is to authorise INDX to access your Fitbit data.");
        //     $("#step-text").show();
        //     $.ajax({
        //         url: "api",
        //         data: {"gotourl": ""},
        //         type: "POST",
        //         dataType: "json",
        //         success: function(data, status, xhr){
        //             var gotourl = data.url;
        //             $("#step-load").hide();
        //             $("#step-authurl").find("a").attr("href", gotourl);
        //             $("#step-authurl").show();
        //             $("#step-pin").show();
        //             $("#step-btn-pin").show();
        //         }
        //     });
        // };

        // var setToken = function(token) {
        //     $.ajax({
        //         url: "api",
        //         data: {"token": token},
        //         type: "POST",
        //         dataType: "json",
        //         success: function(data, status, xhr){
        //             showDownloadOption();
        //         }
        //     });
        // };

        // $scope.setPin = function(pin) {
        //     u.debug("pin is :" + pin);
        //     $.ajax({
        //         url: "api",
        //         data: {"pin": $("#step-pin").find("input").val()},
        //         type: "POST",
        //         dataType: "json",
        //         success: function(data, status, xhr){
        //             u.debug("token is: " + data.token);
        //             config.set("authToken", data.token);
        //             config.save().then(function(h) { u.debug('saved config token' + config.authToken); })
        //                         .fail(function(e) { u.error('could not save config token'); });
        //             showDownloadOption();
        //         }
        //     });
        // };

        // var showDownloadOption = function() {
        //     console.log("show download button");
        //     $("#step-load").hide();
        //     $("#step-authurl").hide();
        //     $("#step-pin").hide();
        //     $("#step-btn-pin").hide();
        //     if (config && config.get("authToken")) {
        //         if (!config.get("upToDate")) {
        //             $("#step-text").text("INDX was never synced with Fitbit. Click the button below if you would like to start the download now.");
        //         }
        //         else {
        //             lastSync = new Date(parseInt(config.get("upToDate")));
        //             $("#step-text").text("The last sync was on "+lastSync.toISOString()+". Click the button below if you would like to start the download now.");
        //         }
        //         $("#step-text").show();
        //         $("#step-btn-download").show();
        //     }
        // };

        // $scope.startDownload = function() {
        //     console.log("starting download");
        //     $("#step-load").show();
        //     var upToDate, fromDate, observations;
        //     if (config.get("fromDate")) {
        //         start = new Date(parseInt(config.get("upToDate")));
        //         console.log(start.toISOString());
        //         $.ajax({
        //             url: "api",
        //             data: {"download": "true", "start": start.valueOf()},
        //             type: "POST",
        //             dataType: "json",
        //             success: function(data, status, xhr){
        //                 upToDate = Date.parse(data.upToDate);
        //                 observations = JSON.parse(data.observations);
        //                 saveObservations(observations, upToDate);
        //             }
        //         });
        //     } else {
        //         $.ajax({
        //             url: "api",
        //             data: {"download": "true"},
        //             type: "POST",
        //             dataType: "json",
        //             success: function(data, status, xhr){
        //                 upToDate = Date.parse(data.upToDate);
        //                 fromDate = Date.parse(data.fromDate);
        //                 observations = JSON.parse(data.observations);
        //                 saveObservations(observations, upToDate, fromDate);
        //             }
        //         });
        //     }
        // };

        // var saveObservations = function(observations, upTo, from) {
        //     // config.set(each of the observation in the list);
        //     box.getObj('fitbitDataset').then(function (ds) {
        //         ds.set({
        //             // @type: 'http://purl.org/linked-data/cube#Dataset',
        //             device: 'Fitbit Connector',
        //         });
        //         ds.save()
        //             // .then(function(e) { u.debug('created and saved dataset ' + ds.get('@id')); })
        //             .fail(function(e) { u.error('could not save dataset ', e); });
        //         dps = [];
        //         observations.map(function(obs) {
        //             st = Date.parse(obs['start']).valueOf();
        //             box.getObj('fitbitObs_' + st).then(function (o) {
        //                 o.set({
        //                     // @type: 'http://purl.org/linked-data/cube#Observation',
        //                     start: Date.parse(obs['start']).valueOf(), 
        //                     end: Date.parse(obs['end']).valueOf(),
        //                     dataset: ds.get('@id'),
        //                 });
        //                 if ('stepCount' in obs) {
        //                     o.set({stepCount: obs['stepCount']});
        //                 }
        //                 if ('caloriesBurned' in obs) {
        //                     o.set({caloriesBurned: obs['caloriesBurned']});
        //                 }
        //                 if ('distance' in obs) {
        //                     o.set({distance: obs['distance']});
        //                 }
        //                 if ('floorsClimbed' in obs) {
        //                     o.set({floorsClimbed: obs['floorsClimbed']});
        //                 }
        //                 if ('elevation' in obs) {
        //                     o.set({elevation: obs['elevation']});
        //                 }
        //                 o.save()
        //                     .then(function(e) { 
        //                         dps.push(o); // should this be o.get('@id') ? 
        //                         ds.set({dataPoints: dps});
        //                         ds.save()
        //                             .then(function(e) { 
        //                                 // u.debug('created and saved new dataset ' + ds.get('@id')); 
        //                             })
        //                             .fail(function(e) { u.error('could not save new dataset ', e); });
        //                         // u.debug('created and saved new observation ' + o.get('@id')); 
        //                     })
        //                     .fail(function(e) { u.error('could not save new observation ', e); });
        //             }).fail(function(e) {
        //                 u.error('could not create new observation ', e);
        //             });
        //         });
        //     }).fail(function(e) {
        //         u.error('could not create new dataset ', e);
        //     });
            
        //     if (upTo) {
        //         config.set("upToDate", upTo);
        //     }
        //     if (from) {            
        //         config.set("fromDate", from);
        //     }
        //     config.save().then(function(h) { u.debug('saved config dates'); })
        //                 .fail(function(e) { u.error('could not save config dates'); });
        //     $("#step-load").hide();
        // };

        $scope.$watch('selectedUser', function() {
            if ($scope.selectedUser) {
                console.log('selected ', $scope.selectedUser);
                getUsersAndBoxes().then(function() {
                    getConfigFromService();
                });
            }
        });
        // window.s = client.store;
        // initialise();
    });

