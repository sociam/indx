
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	fs = require('fs'),
	jQuery = require('jquery'),
	config_file = __dirname + '/.config.json',
	argv = require('optimist').argv,
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	debugfilename = './debug.log';


// savin' the config
var save_config = function(config) {
	var pretty = JSON.stringify(config, null, 4), d = u.deferred();
	fs.writeFile(config_file, pretty, function(err) { if(err) { d.reject(err); return; } d.resolve();}); 
	return d.promise();
};
var debug = function() {
	console.debug.apply(console,arguments);
	var argstr = _(arguments).toArray().map(function(x) { return x ? x.toString() : ''; });
	fs.appendFile(debugfilename, (new Date()).valueOf() + ' - ' + argstr.join(' ') + '\n', function(err) { 
		if (err) { console.error('error outputting debug'); }
	});
};

// loadin' the config
var load_config = function() {
	var d = u.deferred();
	if (fs.existsSync(config_file)) { 
		fs.readFile(config_file, 'utf8', function (err, data) {	
			if (err) { d.reject(err); return; } 
			data = JSON.parse(data);
			d.resolve(data);
		});
	} else {
		debug('no config file ', config_file);
		d.resolve({});
	}
	return d.promise();
};

if (require.main === module) {
	// check arguments
	if (argv.getconfig) {
		debug('get config');
		try { 
			load_config().then(function(config) {  console.log(config);	});
		} catch(e) { 
			debug(' error loading config ' + e.toString());
			console.log(JSON.stringify({status:500,message:"error loading config"}));
		}
	} else if (argv.setconfig) {
		debug('set config');
		try{ 
			var jsonconfig = JSON.parse(argv.setconfig);
			save_config(jsonconfig).then(function() { 
				console.log(JSON.stringify({status:200,message:"ok - configuration saved"}));
			}).fail(function(f) {
				console.error(f);
			});
		} catch(e) {
			console.error("error parsing config json ", argv.set_config);
		}
	} else {
		// run!
		debug('starting up >> server -- ', argv.indxhost);
		if (argv.indxhost) {
			nodeindx.login().then(function(store) { 
				store.getBoxList().then(function(bid) { 
					store.getBox(bid).then(function(box) { count_props(box); }).fail(function(err) { console.error(err); });
				}).fail(function(err) { 
					console.debug('error > ', err);
				});
			}).fail(function() { console.error('fail logging :('); });			
		} else {
			console.error('no indx server specified; use --indxhost'); 
		}
	}	
}