
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils;
var fs = require('fs');
var config_file = __dirname + '/.config.json';
var argv = require('optimist').argv;

// savin' the config
var save_config = function(config) {
	var pretty = JSON.stringify(config, null, 4), d = u.deferred();
	fs.writeFile(config_file, pretty, function(err) {
		if(err) { d.reject(err); return; }
		d.resolve();
	}); 
	return d.promise();
};

// loadin' the config
var load_config = function() {
	var d = u.deferred();
	fs.readFile(config_file, 'utf8', function (err, data) {
		if (err) { d.reject(err); return;	}
		data = JSON.parse(data);
		d.resolve(data);
	});
	return d.promise();
};

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
		console.debug('checking lz_timeout ', __lz_timeout.length);
		if (!__lz_timeout.length) { 
			lazy_timeout(function() { console.debug(" lets save > "); boxstats.save(); });
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
		console.debug('obj-add new item! ', id);
		if (boxstats) {
			box.getObj(id).then(function(obj) {
				var count = count_obj(obj);
				console.debug(' has count ', count);
				hist[count] = hist[count] ? hist[count] + 1 : 1;
				update_boxstats(hist);
			});
		}
	});
};

if (require.main === module) {
	// check arguments
	if (argv.get_config) {
		load_config().then(function(config) {  console.log(config);	});
	} else if (argv.set_config) {
		try{ 
			var jsonconfig = JSON.parse(argv.set_config);
			save_config(jsonconfig).then(function() { 
				console.log(JSON.stringify({status:200,message:"ok"}));
			}).fail(function(f) {
				console.error(f);
			});
		} catch(e) {
			console.error("error parsing config json ", argv.set_config);
		}
	} else {
		// run!
		console.debug('starting up >> ');
		nodeindx.login().then(function(store) { 
			store.getBoxList().then(function(bid) { 
				store.getBox(bid).then(function(box) { count_props(box); }).fail(function(err) { console.error(err); });
			}).fail(function(err) { 
				console.debug('error > ', err);
			});
		}).fail(function() { console.error('fail logging :('); });
	}	
}