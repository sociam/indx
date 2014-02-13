/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console */

/*
  This is the entity manager class which consists of utility functions
  to simplify the cross-app discussion of certin entities
*/

(function() {
	angular
		.module('indx')
		.factory('entities', function(client, utils) {
			var u = utils;

			var to_obj = function(box, obj) {
				var d = u.deferred();
				if (obj instanceof client.Obj) { return u.dresolve(obj); }
				if (!_.isObject(obj)) { return u.dresolve(obj); }
				var uid = obj['@id'] || obj.id || u.guid();

				box.getObj(uid).then(function(model) {
					var ds = _(obj).map(function(v,k) {
						var dk = u.deferred();
						if (_(v).isObject(v) && !(v instanceof client.Obj)) {
							to_obj(box,v).then(function(vobj) {
								model.set(k,vobj);
								dk.resolve();
							}).fail(function() {
								dk.reject();
							});
						} else {
							model.set(k,v);
							dk.resolve();
						}
						return dk.promise();
					});
					u.when(ds).then(function() { d.resolve(model); }).fail(function() { d.reject('error setting properties'); });
				});
				return d.promise();
			};

			var toQueryTime = function(date) {	
				return date.toISOString().slice(0,-5);	// chop off the .000Z or queries don't like it
			};

			var slowQuery = function(box, properties) {
				var d = u.deferred(), results = [];
				box.getObj(box.getObjIDs()).then(function(objs) {
					window._objs = objs;
					var hits = objs.filter(function(obj) { 
						var results = _(properties).map(function(v,k) {
							console.info(obj.id, '.peek(',k,') => ', obj.peek(k), obj.attributes && obj.attributes[k], obj.attributes, ' == ', v);
							return obj && (obj.peek(k) == v || (obj.get(k) && (obj.get(k).indexOf(v) >= 0)));
						});
						return results.reduce(function(x,y) { return x && y; }, true);
					});
					d.resolve(hits);
				}).fail(d.reject);
				return d.promise();
			};

			var search = function(box, properties) {
				// query is broken :( so going to manually rig it.
				//return slowQuery(box,properties);
				return box.query(properties);
			};

			var LATLNG_THRESH = 0.0005;

			return {
				toObj:to_obj,
				locations: {
					getAll: function(box, extras) {
						return search(box, _(extras || {}).chain().clone().extend({'type':'location'}).value());
					},
					getByLatLng: function(box, lat, lng) {
						u.assert(box, 'box is undefined');
						u.assert(lat, 'lat is undefined');
						u.assert(lng, 'lng is undefined');						
						var d = u.deferred();						
						this.getAll(box).then(function(results) { 
							var dist = {}, resD = {};
							results.map(function(result) {
								if (!(result.peek('latitude') && result.peek('longitude') )) { return; }
								dist[result.id] = Math.max( 
									Math.abs(result.peek('latitude') - lat), 
									Math.abs(result.peek('longitude') - lng)
								);  // Math.sqrt( Math.pow(result.peek('latitude') - lat,2) + Math.pow(result.peek('longitude') - lng, 2) );
								// console.log(' dist > ', result.peek('latitude'), lat, result.peek('longitude'), lng, dist[result.id]);
								resD[result.id] = result;
							});
							var kbyD = _(dist).keys();
							kbyD.sort(function(a,b) { return dist[a] - dist[b]; });
							// console.log('kbyD > ', kbyD);
							var hits = kbyD.filter(function(k) { return dist[k] < LATLNG_THRESH; }).map(function(k) { return resD[k]; });
							console.info('filtered hits >> ', hits.length);
							d.resolve(hits);
						});
						return d.promise();
					},
					getByMovesId: function(box, movesid) {
						return this.getAll(box, { moves_id: movesid });
					},
					getByName:function(box, name) {
						return this.getAll(box, { name: name });
					},
					getByFoursquareId:function(box, fsqid) {
						return this.getAll(box, { foursquare_id: fsqid });
					},					
					make:function(box, name, location_type, latitude, longitude, moves_id, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, 'name', 'location_type', 'latitude', 'longitude', 'moves_id'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						var id = 'location-'+u.guid(); // ['location', name || '', location_type && location_type !== 'unknown' ? location_type : '' , moves_id ? moves_id : '', latitude.toString(), longitude.toString() ].join('-');
						box.getObj(id).then(function(model) {
							model.set(argset);
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.set({'type':'location'});
							// console.log('SAVING LOCATION >>>>>>>>>>>>>>> ', model);
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				activities:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:'activity'}).value());
					},
					getByActivityType:function(box, tstart, tend, activity_types) {
						if (!_.isArray(activity_types)) { activity_types=[activity_types]; }
						var query = ({
							'$and':[ 
							{type:'activity'},
							{'$or': activity_types.map(function(atype) { return {'activity': atype}; })}
						]});
						if (tstart) { query.$and.push({'tstart': {'$ge': toQueryTime(tstart) }}); }
						if (tend) { query.$and.push({'tstart': {'$le': toQueryTime(tend)}}); }
						console.log('ENTITIES query ... ', JSON.stringify(query));
						return search(box, query);
					},
					getByTimeseriesPointsPerMinute:function(box, ts, tstart, tend) {
						// ts in {'fitbit_steps_ts', 'fitbit_calories_ts', 'fitbit_distance_ts', 'fitbit_floors_ts', 'fitbit_elevation_ts', 'nikeplus_steps_ts', 'nikeplus_calories_ts', 'nikeplus_fuel_ts', 'nikeplus_stars_ts'}
						if (ts && tstart && tend) {
							var query = ( {'$and': [ 
									{'timeseries':ts}, 
									{'tstart':{'$ge':toQueryTime(tstart)} },
									{'tend':{'$le':toQueryTime(tend)} }
								] } );
							console.log('issuing query ... ', JSON.stringify(query));
							return search(box, query);
						}
						return u.dreject('must specify all arguments: ts, tstart, tend');
					},
					getFitbitStepsPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'fitbit_steps_ts', tstart, tend);
					},
					getFitbitCaloriesPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'fitbit_calories_ts', tstart, tend);
					},
					getFitbitDistancePerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'fitbit_distance_ts', tstart, tend);
					},
					getFitbitFloorsPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'fitbit_floors_ts', tstart, tend);
					},
					getFitbitElevationPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'fitbit_elevation_ts', tstart, tend);					},
					getNikeStepsPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'nikeplus_steps_ts', tstart, tend);
					},					
					getNikeCaloriesPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'nikeplus_calories_ts', tstart, tend);
					},					
					getNikeFuelPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'nikeplus_fuel_ts', tstart, tend);
					},					
					getNikeStarsPerMin:function(box, tstart, tend) {
						return this.getByTimeseriesPointsPerMinute(box, 'nikeplus_stars_ts', tstart, tend);
					},					
					make1:function(box, activity_type, whom, from_t, to_t, distance, steps, calories, waypoints, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var id = ['activity', whom && whom.id || '', activity_type || '', from_t.valueOf().toString(), to_t.valueOf().toString()].join('-');
						var argnames = [undefined, 'activity', 'whom', 'tstart', 'tend', 'distance', 'steps', 'calories', 'waypoints'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							// // TODO REMOVE ME
							// // HACK PATCH TO MAKE sure all activities all have duration at least 1 msec
							// if (argset.tend) { 
							// 	var valval = new Date(argset.tend.valueOf() + 1);
							// 	// console.log('resetting tend ', argset.tend, valval);
							// 	argset.tend = valval;
							// } 
							model.set(argset);
							model.set({type:'activity'});
							model.set(otherprops);
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				people:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:'Person'}));
					},
					getByName:function(box, name) {
						var d = u.deferred();
						u.when(this.getAll(box, { names: [name] }), this.getAll(box, {name:name})).then(function(x,y) {
							var results = _.uniq( ([] || x).concat(y) );
							d.resolve(results);
						}).fail(d.reject);
						return d.promise();
					},
					getByGivenName:function(box, name) { return this.getAll(box, { given_name:[name] }); },
					getBySurname:function(box, name) { return this.getAll(box, { surname:[name] }); },
					getByTwitter:function(box, name) { return this.getAll(box, { twitter_id:[name] }); },
					getByEmail:function(box, name) { return this.getAll(box, { email:[name] }); },
					make:function(box, id, givenname, surname, other_names, emails, twitter, facebook_url, linkedin_url, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, undefined, 'given_name', 'surname', 'name', 'email', 'twitter_id', 'facebook_id', 'linkedin_id'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							model.set({type:'person'});
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				documents:{
					getWebPage:function(box, url) {
						return search(box, url ? { url: url, type:'web-page' } : { type: 'web-page' });
					},
					makeWebPage:function(box, url, title, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var id = url;
						var argnames = [undefined, 'url', 'title'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							model.set({type:'web-page'});
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					},
					getMyTweets:function(box, tstart, tend) {
						if (tstart && tend) {
							var query = ( { '$and': [
									{'type':'post'},
									{'tweet_user_id_indx':'twitter_user_me'},
									{'created_at':{'$ge':toQueryTime(tstart)}},
									{'created_at':{'$le':toQueryTime(tend)}}
									] } );
							console.log('issuing query ... ', JSON.stringify(query));
							return search(box, query);
						}
						return u.dreject('must specify all arguments: tstart, tend');
					},
					getInstagram:undefined,
					getFBMessage:undefined,
					getFBWallPost:undefined,
				},
				sensors:{
					getByName:undefined,
					getByActivity:undefined,
					make:undefined
				}
			};
		});
})();