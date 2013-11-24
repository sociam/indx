
// first ever angular

var angular = require('angular'),
	Backbone = require('backbone'),
	_ = require('underscore'),
	jQuery = require('jquery'),
	fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var window = {}, document = {location:{}};

var savage_require = function(path) { eval(fs.readFileSync(path)+''); };

var indx_ = savage_require('../../html/js/indx.js'),
	utils_ = savage_require('../../html/js/indx-utils.js');

var	injector = angular.injector(['ng','indx']);

var u = injector.get('utils'),
	indx = injector.get('client');

var username='emax',
	password='emax',
	hostname = 'https://indx.local:8211';

console.log('store is >> ', indx.Store);

var s = new indx.Store({server_host:hostname});
s.login(username,password).then(function(x) {
	console.log('omg login success ', x);
	s.getBoxList().then(function(bL) { 
		console.log('box list >> ', bL);
	}).fail(function(ff) {
		console.error('failure trying to list boxes ', ff); 
	});
}).fail(function(err) {
	console.error('failure trying to log in >>> ', err);
});

