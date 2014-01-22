angular
    .module('NikeHarvester', ['ui','indx'])
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
            s._ajax('GET', 'apps/nikeplus/api/get_config').then(function(x) { 
                console.log(x.config);
                var config = x.config;
                // var config = JSON.parse(x.config);
                if (config.nike) {
                    if (config.nike.error) {
                        sa(function() { 
                            _($scope).extend({ 
                                nikeerror: config.nike.error,
                                nikeuser: config.nike.user
                            });
                        });                        
                    } else if (config.nike.token) {
                        sa(function() { 
                            _($scope).extend({ 
                                nikeuser: config.nike.user,
                                nikepassword: config.nike.password,
                                token: config.nike.token
                            });
                        });
                    }
                }
                if (config.harvester) {
                    sa(function() { 
                        _($scope).extend({ 
                            password: config.harvester.password,
                            box: config.harvester.box, 
                            overwrite: config.harvester.overwrite
                        });
                    });
                    if (config.harvester.user && $scope.users) { 
                        var match = $scope.users.filter(function(u) { return u['@id'] === config.harvester.user; });
                        if (match.length) {
                            console.log('match ', match[0]);
                            window.match = match[0];
                            sa(function() { 
                                $scope.user = match[0];
                                $scope.checkACL(match[0],config.harvester.box);
                            });
                        }
                    }
                }
                console.log("the current scope ", $scope);
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
        $scope.checkACL = function(user,box) {
            s.getBox(box).then(function(b) { 
                b.getACL().then(function(resp) {
                    console.log('check acl -- ', user, box, resp);
                    if (resp[user['@id']]) {
                        acl = resp[user['@id']];
                        if (acl['read'] && acl['write']) {
                            sa(function() { $scope.granted = true; });
                        } else {
                            sa(function() { $scope.granted = false; });
                        }
                    } else {
                        sa(function() { $scope.granted = false; });
                    }
                    sa(function() { delete $scope.granted_status; });
                }).fail(function(e) {
                    console.log("checking acl fail: ", e);
                    sa(function() { $scope.granted = false; });
                });
            });
        };
        $scope.setConfig = function(config) { 
            console.info('i got a config ', config);
            s._ajax('GET', 'apps/nikeplus/api/set_config', { config: JSON.stringify(config) }).then(function(x) { 
                console.log('success ', x);
                status('configuration chage committed');
                window.retval = x;
            }).fail(function(e) {
                console.error(e);
                status('error committing change ' + e.toString());
            });
        };

        $scope.testLogin = function(nikeconfig) {
            $scope.setConfig(nikeconfig);
            delete $scope.nikeerror;
            getConfigFromService();
        }

        $scope.doStart = function() {
            s._ajax('GET', 'apps/nikeplus/api/start').then(function(x) { 
                console.info('App doStart result: ', x); 
                status('Start command successful'); 
            }).fail(function(x) { status(' Error ' + x.toString()); });
        };
        $scope.doStop = function() {
            console.log('App doStop');
            s._ajax('GET', 'apps/nikeplus/api/stop')
            .then(function(x) { console.info('App Stop result (): ', x); status('Stop command successful'); })
            .fail(function(x) { status(' Error ' + x.toString()); });
        };
        // setInterval(function() { 
        //     s._ajax('GET','apps/nikeplus/api/is_running').then(function(r) { 
        //         sa(function() { 
        //             $scope.runstate = r.running ? 'Running' : 'Stopped';  
        //         });
        //     }).fail(function(r) {
        //         sa(function() { $scope.runstate = 'Unknown'; });
        //     });
        // }, 3000);

        $scope.$watch('selectedUser', function() {
            if ($scope.selectedUser) {
                console.log('selected ', $scope.selectedUser);
                getUsersAndBoxes().then(function() {
                    getConfigFromService();
                });
            }
        });
        $scope.$watch('box', function() {
            if ($scope.box) {
                console.log('box changed ', $scope.box);
                if ($scope.user) {
                    $scope.checkACL($scope.user, $scope.box);
                }
            }
        });
        $scope.$watch('user', function() {
            if ($scope.user) {
                console.log('user changed ', $scope.user);
                if ($scope.box) {
                    $scope.checkACL($scope.user, $scope.box);
                }
            }
        });

    });

