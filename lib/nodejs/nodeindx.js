
// nodejs shims for indxjs
// you can 'require' me like : require('nodeindx'))
// 

var angular = require('angular'),
	Backbone = require('backbone'),
	_ = require('underscore'),
	jQuery = require('jquery'),
	fs = require('fs'),
	WebSocket = require('ws'),
	argv = require('optimist').argv;

// compatibility shims start here >>>>>>> 
console.debug = console.error;
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
var username=argv.username || 'emax',
	password=argv.password || 'emax',
	hostname=argv.host || argv.hostname || 'https://localhost:8211';

console.debug('user: ', username, ' passwordlen: ', password.length, ' - ', hostname);

module.exports = {
	username:username,
	password:password,
	hostname:hostname,
	utils:u,
	indx:indx,
	login: function() {
		console.debug('attempting login >> ');
		var s = new indx.Store({server_host:hostname}), d = u.deferred();
		s.login(username,password)
			.then(function(x) { d.resolve(s); })
			.fail(function(err) { d.reject('error logging in -- ', err); });
		return d.promise();
	}
};

if (require.main === module) {
	module.exports.login()
		.then(function() { console.debug('ok!'); })
		.fail(function() { console.error('fail :('); });
}