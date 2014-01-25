/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console */

(function () {
    var GEO_JOURNAL_ID = localStorage.indx_geojournal_id || 'indx-chrome-geolocation';
    var GEO_OBJ_TYPE = localStorage.indx_webjournal_type || 'geolocated';

    // Each degree of latitude is approximately 69 miles (111 kilometers) apart.
    var THRESHOLD = 0.05;

    var getBoxName = function() { return localStorage.indx_box || 'lifelog'; };
    var err = function(error) { console.error(error); };
    var position_options = { enableHighAccuracy:true, timeout: Infinity, maximumAge: Infinity  };

    var app = angular.module('webjournal').factory('geowatcher', function(utils,client,entities,pluginUtils) {
        // plugin that watches for geo changes
        var u = utils, pu = pluginUtils;
        var GeoWatcher = Backbone.Model.extend({
            defaults: { enabled:true },
            initialize:function(attributes) {
                var this_ = this, err = function(e) { this_.trigger('error', e); };
                this.on('change:current_activity', function() {
                    var pos = this_.get('current_activity');
                    console.info('current activity (position) changed >> ', pos && pos.peek('waypoints') && pos.peek('waypoints').attributes);
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
            update:function() { 
                // manual 
                if (this._last_raw) { this._handle_geo(this._last_raw); }
            },
            _handle_geo:function(raw_pos) {
                // debug >> 
                console.log('_geochange', raw_pos);
                var d = u.deferred(), this_ = this;
                var crds = raw_pos.coords, curpos = this.get('current_activity') && this.get('current_activity').peek('waypoints'), box = this.get('box'), whom = this.get('whom'), now = new Date();
                this._last_raw = raw_pos; // we keep this around for manual 'update' requests
                if (this._fetching_geo) { 
                    // we are already fetching so let's just replace -- we'll come bac to this
                    this._fetching_supercede = raw_pos; 
                    return;
                }
                if ( !curpos || (Math.abs(crds.latitude - curpos.peek('latitude')) > THRESHOLD || Math.abs(crds.latitude - curpos.peek('longitude')) > THRESHOLD) )  {
                    // graduate cur_pos
                    this.unset('current_activity');
                    this._fetching_geo = true;
                    this._getLocation(raw_pos.coords.latitude,raw_pos.coords.longitude).then(function(mpos) { 
                        console.log("GOT LOCATION >> ", mpos);
                        delete this_._fetching_geo;
                        if (this_._fetching_supercede) {
                            // if we got an update position let's fill in those
                            var ncords = this_._fetching_supercede;
                            delete this_._fetching_supercede;
                            return this_._handle_geo(ncords);
                        }
                        entities.activities.make1(box, 'stay', whom, now, now, undefined, undefined, undefined, mpos).then(function(actm) {
                            console.log('setting current activity >> ', actm, actm.peek);
                            this_.set('current_activity', actm);
                            actm.save().then(d.resolve).fail(d.reject);
                        }).fail(d.reject);
                    }).fail(function(err) { 
                        console.error(' failed getting location ', err);
                    });
                    return;
                } else if (curpos) {
                    // just update the activyt
                    var curact = this.get('current_activity');
                    curact.set({tend:now});
                    curact.save().then(d.resolve).fail(d.reject);
                }
                return d.promise();
            },
            _getLocation: function(lat, lon){
                console.log('_getlocation --------- ', lat, lon);
                var d = u.deferred(), box = this.get('box');
                entities.locations.getByLatLng(box, lat, lon).then(function(existing) {
                    console.log('getLocation result >> existing loc ? ', existing && existing[0]);
                    var ddone = existing && existing.length ? u.dresolve(existing[0]) : entities.locations.make(box,undefined,'chrome-inferred',lat,lon);
                    ddone.then(function(mloc) { d.resolve(mloc); }).fail(d.reject);
                }).fail(d.reject);
                return d.promise();
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
            },
            update:function() { 
                if (this.watcher) { return this.watcher.update(); }
            }
        };
   });
})();