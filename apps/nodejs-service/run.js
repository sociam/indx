
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
	hostname='https://indx.local:8211';

console.log('store is >> ', indx.Store);

var counts_to_hist = function(raw_counts) {
	var hist = {};
	raw_counts.map(function(c) {
		hist[c] = hist[c] ? hist[c] + 1 : 1;
	});
	return hist;
};

var __lz_timeout = [], _timeout;
var lazy_timeout = function(fn) {
	__lz_timeout.push(fn);
	if (_timeout) { clearTimeout(_timeout);	}
	_timeout = setTimeout(function() { 
		var dudes = __lz_timeout.concat();
		__lz_timeout = [];
		_timeout = undefined;
		dudes.map(function(fn) { fn(); });
	}, 1000);
};


var count_props = function(box) {
	var ids = box.getObjIDs().concat(['boxstats-hist-n-properties']);
	var count_obj = function(o) { return _(o.attributes).size();};
	var boxstats;

	var update_boxstats = function(hist) {
		boxstats.set(hist);
		boxstats.set({min: _(hist).chain().keys().min().value(), max:_(hist).chain().keys().max().value() });
		console.log('checking lz_timeout ', __lz_timeout.length);
		if (!__lz_timeout.length) { 
			lazy_timeout(function() { console.log(" lets save > "); boxstats.save(); });
		}
	};

	box.getObj(ids).then(function(objs) {
		boxstats = objs[objs.length-1];
		objs = objs.slice(0,objs.length - 1);
		var counts = objs.map(count_obj);
		hist = counts_to_hist(counts);
		update_boxstats(hist);
	});
	box.on('obj-add', function(id) {
		// dynamically update boxstats	
		console.log('obj-add new item! ', id);
		if (boxstats) {
			box.getObj(id).then(function(obj) {
				var count = count_obj(obj);
				console.log(' has count ', count);
				hist[count] = hist[count] ? hist[count] + 1 : 1;
				update_boxstats(hist);
			});
		}
	});
};

var s = new indx.Store({server_host:hostname});
s.login(username,password).then(function(x) {
	console.log('conclusion of login ...................... ');
	s.getBoxList().then(function(bL) {
		if (bL.length) { 
			var b0 = bL[0];
			s.getBox(b0).then(function(b) {
				console.log("Got box >> ", b.id, ' - ', b.getObjIDs()); // count_types(b);
		 		count_props(b);
		 	});
		}
	}).fail(function(ff) {
		console.error('failure trying to list boxes ', ff); 
	});
}).fail(function(err) {
	console.error('failure trying to log in >>> ', err);
});

