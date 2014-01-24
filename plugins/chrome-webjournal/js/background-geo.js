(function() { 
    var GEO_JOURNAL_ID = localStorage.indx_geojournal_id || 'indx-chrome-geolocation';
    var GEO_OBJ_TYPE = localStorage.indx_webjournal_type || 'geolocated';

    var getBoxName = function() { return localStorage.indx_box || 'lifelog'; };
    var err = function(error) { console.error(error); };

    var position_options = {
        enableHighAccuracy:true,
        timeout: Infinity,
        maximumAge: Infinity
    };

    var app = angular.module('webjournal').factory('geowatcher',
        function(utils, client,entities) {
            // plugin that watches for geo changes
            var u = utils;
            var GeoWatcher = Backbone.Model.extend({
                defaults: { enabled:true },
                initialize:function(attributes) {
                    var this_ = this, err = function(e) { this_.trigger('error', e); };
                    this.on('change:current_position', function(pos) {
                        console.info('current position changed >> ', pos && pos.coords);
                    });
                    this.on('change:store', function(s) {
                        console.info('geo::change::store '); 
                        this_._load_box().then(function() { this_._init_navigator(); }).fail(function(bail) { err('load box failed'); });
                        this_.unset('box');
                        this_.unset('journal');
                        this_.unset('whom');
                    });
                },
                _init_navigator:function() {
                    var this_ = this;
                    if (!this._watching) {
                        navigator.geolocation.watchPosition(function(pos) { this_._handle_geo(pos); }, err, position_options);
                        navigator.geolocation.getCurrentPosition(function(pos) {  this_._handle_geo(pos); }, err, position_options);
                        this._watching = true;
                    }
                },
                _load_box:function() {
                    var store = this.get('store'), this_ = this, d = u.deferred();
                    if (!getBoxName()) { err('geowatcher ~~~ no box specified '); return; }
                    if (store) {
                        console.info('geowatcher getting box ');
                        store.getBox(getBoxName()).then(function(b) { 
                            var duser = u.deferred(), dj = u.deferred();
                            this_.set('box', b);
                            b.getObj(GEO_JOURNAL_ID).then(function(jobj) {
                                this_.set('journal',jobj);
                                jobj.save().then(dj.resolve).fail(dj.reject); // make sure it exists.
                            });
                            // console.log('STORE USERNAME >> ', store.get('username'));
                            if (store.get('username')) {
                                b.getObj(store.get('username')).then(function(user_model) { 
                                    this_.set('whom', user_model); 
                                    duser.resolve();
                                }).fail(function(bail) { 
                                    err('error getting user >> ', store.get('username')); 
                                    duser.reject();
                                });
                            }
                            jQuery.when(dj,duser).then(d.resolve).fail(d.reject);
                        });
                    }
                    return d.promise();
                },
                _handle_geo:function(raw_pos) {
                    // debug >> 
                    console.log('_geochange', raw_pos);
                    var cur_pos = this.get('current_position'), pos = this._make_record(raw_pos), now = new Date();
                    if (cur_pos){
                        cur_pos.tend = now;
                        this.data.push(cur_pos);
                        this._commit();
                    }
                    cur_pos = pos;
                    this.data.push(cur_pos);
                    this._commit();
                },
                _make_record:function(pos) {
                    var now = new Date();
                    var locd = this_._getLoc(pos.latitude, pos.longitude); 

                    return {
                        tstart: now, tend: now, 
                        latitude: pos.coords.latitude, 
                        longitude: pos.coords.longitude
                    };
                },
                _dequeue:function(pos) {
                    this.data = _(this.data).without(pos);
                },
                _getLoc: function(lat, lon){
                    entities.locations.getByLatLng(this.get('box'), lat, lng).then(function(existing) {
                        var ddone = existing && existing.length ? u.dresolve(existing[0]) : makeLoc();
                        ddone.then(function() { 
                        });
                    });
                },
                _commit:function() {
                    console.info('geowatcher ~~~~ commit!! ', pos);
                    var this_ = this, 
                        journal = this.get('journal'), 
                        box = this.get('box'),
                        whom = this.get('whom')
                        queue = this.data;

                    if (journal && box) { 
                        queue.concat().map(function(pos) {


                            locd.then(function(location) {
                                entities.activities.make1(box, 'stay', whom, tstart, tend, undefined, undefined, undefined, location).then(function(act) {
                                    act.set({dataset:journal});
                                    act.save().then();
                                });
                            })

                            var pos = _({ whom:whom, journal:journal }).extend(pos);
                            var id = pos.id;
                            delete pos.id;
                            // console.info('pos pre is ', pos, ' id is ', id);
                            box.getObj(id).then(function(posobj) {
                               this_.dequeue(pos)
                               posobj.set(pos);
                               posobj.save();
                           }).fail(function(e) { this_.trigger('connection-error', e); });
                        });
                        this_.data = this_.data.slice(data.length);
                    } 
                }
            });

        return {
            init:function(store) {
                if (!this.watcher) { 
                    this.watcher = new GeoWatcher({store:store});
                }
                return this.watcher;
            },
            set_store:function(store) { 
                if (this.watcher) { this.watcher.set({store:store}); }
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
    }
})();

