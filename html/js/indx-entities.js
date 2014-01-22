/**
  This is the entity manager class which consists of utility functions
  to simplify the cross-app discussion of certin entities
*/

(function() {
	angular
		.module('indx')
		.factory("entities", function(client, utils) { 
			var u = utils;
			var to_obj = function(box, obj) {
				// if 
				var d = u.deferred(), this_ = this;


				if (obj instanceof client.Obj) { return u.dresolve(obj); }
				if (!_.isObject(obj)) { return u.dresolve(obj); }

				var uid = obj["@id"] || obj.id || u.guid();

				box.getObj(uid).then(function(model) {
					var ds = _(obj).map(function(v,k) {
						var dk = u.deferred();
						if (_(v).isObject(v) && !(v instanceof client.Obj)) {
							make_obj(box,v).then(function(vobj) { 
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
					u.when(ds).then(function() { d.resolve(model); })
					.fail(function() { 	d.reject("error setting properties"); });
				});
				return d.promise();
			};

			var search = function(box, properties) {
				return box.query(properties);
			};

			return {
				toObj:to_obj,
				locations: {
					getAll: function(box, extras) { 
						return search(box, _(extras).chain().clone().extend({type:"Location"}).value()); 
					},
					getByLatLng: function(box, lat, lng) { 
						return this.getAll(box, { coords:[{lat: lat, lng: lng }] });
					},
					getByMovesID: function(box, movesid) {
						return this.getAll(box, { coords:[{moves_id: movesid}] });
					},
					getByName:function(box, name) {
						return this.getAll(box, { name: name });
					},
					make:function(box, name, aliases, location_type, latitude, longitude, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, undefined, 'names', 'location_type'];
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							if (names) { model.set({name:names[0]}); }
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops) };
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				activities:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:"Activity"}));
					},
					make:function(box, id, name, domain_type) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, undefined, 'names', 'email', 'twitter_id', 'facebook_id', "linkedin_id"];
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							if (names) { model.set({name:names[0]}); }
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops) };
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					},
					makeStay:function(who, where, from_t, to_t, while_other_activities) {
						// mandatory: who, where from, to
						// optional : while_other_activities
						var id = ['stay-activity', who.id, where.id, from_t.valueOf(), to_t.valueOf()].join('-'), d = u.deferred();
						box.getObj(id).then(function(model) { 
							model.set({
								type:'activity',
								activity:'stay',
								who: who,
								where: where,
								tstart: from_t,
								tend:end_t,
								"while": while_other_activities ? while_other_activities : undefined
							});
							d.resolve(model);
						}).fail(d.reject);
						return d.promise();
					},
					makeWalk:function(whom, from_t, to_t, from_where, to_where, at_where, along, steps, fuel, calories) {
						// where - optional Location 
					},
					makeCycle:function(whom, from_t, to_t, from_where, to_where, along, steps, fuel, calories)	{

					},
					makeRun:function(whom, from_t, to_t, from_where, to_where, along, steps, fuel, calories)	{

					},
					makeRead:function(whom, from_t, to_t, resource) {

					}
				},
				people:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:"Person"}));
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
						var argnames = [undefined, undefined, 'given_name', 'surname', 'name', 'email', 'twitter_id', 'facebook_id', "linkedin_id"];
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							if (names) { model.set({name:names[0]}); }
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops) };
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				documents:{
					getWebPage:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:"Tweet"}));
					},	
					getTweet:undefined,
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