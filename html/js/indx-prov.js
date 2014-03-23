/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console */


/*
	Max Van Kleek, Laura Dragan
	2014
	Simple Provenance Manager Proof of Concept for INDX platform 
*/

(function() {
	angular
		.module('indx')
		.factory('prov', function(client, utils) {
			var u = utils;
			return {
				certifyAttributes: function(who, what, when) {
					u.assert(what.peek('privateKey') !== undefined, "Private Key undefined");
					u.assert(what/peek('publickey') !== undefined, "public key undefined");
				}
			};
		});
})();