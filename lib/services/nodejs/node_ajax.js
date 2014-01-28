

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
		console.log('request >> ', url, options.type);
		request({
				auth:undefined,
				url:url,
				method:options.type,
				headers:get_headers(options),
				jar:j,
				strictSSL:false,
				rejectUnauthorized: false,
				body:body
			},function(error, clientresp, response) {
				console.log("clientResp.statuscode ", error, clientresp && clientresp.statusCode, response);
				if (!error && (clientresp && (clientresp.statusCode == 200 || clientresp.statusCode == 201))) { 
					return d.resolve(JSON.parse(response));
				}
				d.reject(response);
			});
		return d.promise();
	};
};