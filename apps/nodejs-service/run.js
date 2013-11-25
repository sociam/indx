
// first ever angular

var angular = require('angular'),
	Backbone = require('backbone'),
	_ = require('underscore'),
	jQuery = require('jquery'),
	fs = require('fs'),
	WebSocket = require('ws');


// compatibility shims start here >>>>>>> 
console.debug = console.log;
var window = {}, document = {location:{}};
var savage_require = function(path) { eval(fs.readFileSync(path)+''); };

// now we are going to start the load
var _NODE_AJAX = require('./node_ajax.js'),
	indx_ = savage_require('../../html/js/indx.js'),
	utils_ = savage_require('../../html/js/indx-utils.js');
var	injector = angular.injector(['ng','indx']);
var u = injector.get('utils'),
	indx = injector.get('client');

// please set these parameters to what you want htem to be.
var username='emax',
	password='emax',
	hostname = 'https://indx.local:8211';

console.log('store is >> ', indx.Store);

var s = new indx.Store({server_host:hostname});
s.login(username,password).then(function(x) {
	console.log('conclusion of login ...................... ');
	s.getBoxList().then(function(bL) { 
	 	if (bL.length) { 
	 		var b0 = bL[0];
		 	s.getBox(b0).then(function(b) { 
		 		console.log("Got box >> ", b.id, ' - ', b.getObjIDs());
		 	});
		}
	}).fail(function(ff) {
	 	console.error('failure trying to list boxes ', ff); 
	});
}).fail(function(err) {
	console.error('failure trying to log in >>> ', err);
});
