/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console */


/*
	Max Van Kleek, Laura Dragan
	2014
	Simple Provenance Manager Proof of Concept for INDX platform 
*/

(function() {

	var u;

	var makeProv = function(box, type, props) {
		var d = u.deferred(),
			id = ['prov',type,u.guid()].join('-');

		box.getObj(id).then(function(model) {
			model.set(props);
			model.set({'type':'provenance', 'provtype': type});
			model.save().then(function() { d.resolve(model); }).fail(d.reject);
		});
		return d.promise();
	};

	angular
		.module('indx')
		.factory('prov', function(client, utils) {
			u = utils;
			return {
				makeAccessedProv:function(box, who, what, dstart, dend, contextprops) {
					return makeProv(box, 'access', _({ 
						who: who, what: what, dstart: dstart, dend: dend 
					}).extend(contextprops));
				},
				makeDeletedProv:function(box, who, what, dstart, contextprops) {
					return makeProv(box, 'access', _({ 
						who: who, what: what, dstart: dstart 
					}).extend(contextprops));
				},
				makeEditedProv:function(box, who, what_obj, what_prop, what_val, dstart, dend, contextprops) {
					return makeProv(box, 'modified', _({ who: who, 
						what: what_obj, 
						prop: what_prop,
						value: what_val,
						dstart: dstart, 
						dend: dend
					}).extend(contextprops));
				},
				makeCreatedProv:function(box, who, what, dstart, contextprops) {
					return makeProv(box, 'created', _({ who: who, 
						what: what, 
						dstart: dstart
					}).extend(contextprops));
				}
			};
		});
})();