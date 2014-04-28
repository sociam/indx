/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, $, d3, require */

var angular = require('angular'),
	Backbone = require('backbone'),
	_ = require('underscore'),
	jQ = require('jquery'),
	WebSocket = require('ws');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

module.exports=function(u) { 
	var request = require('request'), qs = require('querystring'), j = request.jar();
	var get_headers = function(options) {
		return {'content-type':options.contentType};
	};
	return function(options) {	
		var d = u.deferred();
		var args = options.data;
		var url = options.url, body;
		args = u.dict( _(args).map(function(v, k) { if (v !== undefined) { return [k,v]; } }).filter(function(x) { return x; }));
		if (typeof args == 'object') {	args = jQ.param(args); }
		if (options.type === 'GET') { 
			url = url + '?' + args;
		} else {
			body = args;
		}
		console.log('request ', options.type, url, body ? body:'<no body>');
		var startTime = (new Date()).valueOf();
		request({
				auth:undefined,
				url:url,
				method:options.type,
				// headers:get_headers(options),
				// headers: {'Connection':'keep-alive'},
				jar:j,
				strictSSL:false,
				rejectUnauthorized:false,
				body:body
			},function(error, clientresp, response) {
				// console.log("clientResp.statuscode ", error, clientresp && clientresp.statusCode, (response && response.slice(0,50)));
				// console.log('elapsedTime ', (new Date()).valueOf() - startTime); 
				if (!error && (clientresp && (clientresp.statusCode == 200 || clientresp.statusCode == 201))) { 
					return d.resolve(JSON.parse(response));
				}
				console.log('response >> ', response);
				d.reject(JSON.parse(response));
			});
		return d.promise();
	};
};