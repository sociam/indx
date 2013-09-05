angular
    .module('fitbit', ['ui','indx'])
    .controller('fitbit', function($scope, client, utils) {

        var box, u = utils, s = client.store;
        $scope.loading = 0;
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

        var initialise = function() {
            $("#step-text").hide();
            $("#step-authurl").hide();
            $("#step-pin").hide();
            $("#step-btn-pin").hide();
            $("#step-btn-download").hide();
            $("#step-load").hide();
        }

        var check_config = function() {
            if (!box) { u.debug('no box, skipping '); return ;}
            console.log("check if previously authorised, and downloads");
            $("#step-load").show();
            box.get_obj('fitbit_config').then(function (conf) {
                config = conf;
                console.log('found config >> ', config);
                if (!config.get("auth_token")) {
                    authorise_app();
                } else {
                    console.log(config.get("auth_token")[0]);
                    set_token(config.get("auth_token")[0]);
                }
            }).fail(function(e) {
                u.error('error ', e);
            });
        };

        var authorise_app = function() {
            $("#step-text").text("The first step is to authorise INDX to access your Fitbit data.");
            $("#step-text").show();
            $.ajax({
                url: "api",
                data: {"gotourl": ""},
                type: "POST",
                dataType: "json",
                success: function(data, status, xhr){
                    var gotourl = data.url;
                    $("#step-load").hide();
                    $("#step-authurl").find("a").attr("href", gotourl);
                    $("#step-authurl").show();
                    $("#step-pin").show();
                    $("#step-btn-pin").show();
                }
            });
        };

        var set_token = function(token) {
            $.ajax({
                url: "api",
                data: {"token": token},
                type: "POST",
                dataType: "json",
                success: function(data, status, xhr){
                    show_download_option();
                }
            });
        };

        $scope.authorise_app_pin = function() {
            u.debug("pin is :" + $("#step-pin").find("input").val());
            $.ajax({
                url: "api",
                data: {"pin": $("#step-pin").find("input").val()},
                type: "POST",
                dataType: "json",
                success: function(data, status, xhr){
                    u.debug("token is: " + data.token);
                    config.set("auth_token", data.token);
                    config.save().then(function(h) { u.debug('saved config token' + config.auth_token); })
                                .fail(function(e) { u.error('could not save config token'); });
                    show_download_option();
                }
            });
        };

        var show_download_option = function() {
            console.log("show download button");
            $("#step-load").hide();
            $("#step-authurl").hide();
            $("#step-pin").hide();
            $("#step-btn-pin").hide();
            if (config && config.get("auth_token")) {
                if (!config.get("up_to_date")) {
                    $("#step-text").text("INDX was never synced with Fitbit. Click the button below if you would like to start the download now.");
                }
                else {
                    last_sync = new Date(parseInt(config.get("up_to_date")));
                    $("#step-text").text("The last sync was on "+last_sync.toISOString()+". Click the button below if you would like to start the download now.");
                }
                $("#step-text").show();
                $("#step-btn-download").show();
            }
        };

        $scope.start_download = function() {
            console.log("starting download");
            $("#step-load").show();
            var up_to_date, from_date, observations;
            if (config.get("from_date")) {
                start = new Date(parseInt(config.get("up_to_date")));
                console.log(start.toISOString());
                $.ajax({
                    url: "api",
                    data: {"download": "true", "start": start.valueOf()},
                    type: "POST",
                    dataType: "json",
                    success: function(data, status, xhr){
                        up_to_date = Date.parse(data.up_to_date);
                        observations = JSON.parse(data.observations);
                        save_observations(observations, up_to_date);
                    }
                });
            } else {
                $.ajax({
                    url: "api",
                    data: {"download": "true"},
                    type: "POST",
                    dataType: "json",
                    success: function(data, status, xhr){
                        up_to_date = Date.parse(data.up_to_date);
                        from_date = Date.parse(data.from_date);
                        observations = JSON.parse(data.observations);
                        save_observations(observations, up_to_date, from_date);
                    }
                });
            }
        };

        var save_observations = function(observations, up_to, from) {
            // config.set(each of the observation in the list);
            box.get_obj('fitbit_dataset').then(function (ds) {
                ds.set({
                    // @type: 'http://purl.org/linked-data/cube#Dataset',
                    device: 'Fitbit Connector',
                });
                ds.save()
                    // .then(function(e) { u.debug('created and saved dataset ' + ds.get('@id')); })
                    .fail(function(e) { u.error('could not save dataset ', e); });
                dps = [];
                observations.map(function(obs) {
                    st = Date.parse(obs['start']).valueOf();
                    box.get_obj('fitbit_obs_' + st).then(function (o) {
                        o.set({
                            // @type: 'http://purl.org/linked-data/cube#Observation',
                            start: Date.parse(obs['start']).valueOf(), 
                            end: Date.parse(obs['end']).valueOf(),
                            dataset: ds.get('@id'),
                        });
                        if ('step_count' in obs) {
                            o.set({step_count: obs['step_count']});
                        }
                        if ('calories_burned' in obs) {
                            o.set({calories_burned: obs['calories_burned']});
                        }
                        if ('distance' in obs) {
                            o.set({distance: obs['distance']});
                        }
                        if ('floors_climbed' in obs) {
                            o.set({floors_climbed: obs['floors_climbed']});
                        }
                        if ('elevation' in obs) {
                            o.set({elevation: obs['elevation']});
                        }
                        o.save()
                            .then(function(e) { 
                                dps.push(o); // should this be o.get('@id') ? 
                                ds.set({data_points: dps});
                                ds.save()
                                    .then(function(e) { 
                                        // u.debug('created and saved new dataset ' + ds.get('@id')); 
                                    })
                                    .fail(function(e) { u.error('could not save new dataset ', e); });
                                // u.debug('created and saved new observation ' + o.get('@id')); 
                            })
                            .fail(function(e) { u.error('could not save new observation ', e); });
                    }).fail(function(e) {
                        u.error('could not create new observation ', e);
                    });
                });
            }).fail(function(e) {
                u.error('could not create new dataset ', e);
            });
            
            if (up_to) {
                config.set("up_to_date", up_to);
            }
            if (from) {            
                config.set("from_date", from);
            }
            config.save().then(function(h) { u.debug('saved config dates'); })
                        .fail(function(e) { u.error('could not save config dates'); });
            $("#step-load").hide();
        };

        $scope.$watch('selected_box + selected_user', function() {
            if ($scope.selected_user && $scope.selected_box) {
                console.log('selected ', $scope.selected_user, $scope.selected_box);
                s.get_box($scope.selected_box).then(function(b) {
                    box = b; 
                    check_config();
                }).fail(function(e) { u.error('error ', e); });
            }
        });
        window.s = client.store;
        initialise();
    });

