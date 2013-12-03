
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	fs = require('fs'),
	jQuery = require('jquery'),
	path = require('path'),
	config_file = path.resolve(__dirname, '/.config.json'),
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	debugfilename = path.resolve(__dirname, './.debug.log');

var NodeService = function() {
	this._check_args();
};

_(NodeService.prototype).extend({ 
	_check_args: function() {
		var argv = require('optimist').argv, this_ = this;
		if (argv.getconfig) {
			this.debug('get config');
			try { 
				this.load_config().then(function(config) {  console.log(config);	});
			} catch(e) { 
				this.debug(' error loading config ' + e.toString());
				console.log(JSON.stringify({status:500,message:"error loading config"}));
			}
		} else if (argv.setconfig) {
			this.debug('set config');
			try{ 
				var jsonconfig = JSON.parse(argv.setconfig);
				this.save_config(jsonconfig).then(function() { 
					console.log(JSON.stringify({status:200,message:"ok - configuration saved"}));
				}).fail(function(f) {
					console.error(f);
				});
			} catch(e) {
				console.error("error parsing config json ", argv.set_config);
			}
		} else {
			// run!
			this.debug('starting up >> server -- ', argv.indxhost);
			if (argv.indxhost) {
				nodeindx.login().then(function(store) { this_.run(store); }).fail(function() { console.error('fail logging :('); });			
			} else {
				console.error('no indx server specified; use --indxhost'); 
			}
		}
	},
	run:function(store) {
		// override me
		var this_ = this;
		store.getBoxList().then(function(boxids) { 
			this_.debug('got boxes >> ', boxids);
			//	store.getBox(bid).then(function(box) { count_props(box); }).fail(function(err) { console.error(err); });
		}).fail(function(err) { this_.debug('error > ', err); });
	},
	save_config : function(config) {
		var pretty = JSON.stringify(config, null, 4), d = u.deferred();
		fs.writeFile(config_file, pretty, function(err) { if(err) { d.reject(err); return; } d.resolve();}); 
		return d.promise();
	},
	debug : function() {
		console.debug.apply(console,arguments);
		var argstr = _(arguments).toArray().map(function(x) { return x ? x.toString() : ''; });
		fs.appendFile(debugfilename, (new Date()).toString() + ' - ' + argstr.join(' ') + '\n', function(err) { 
			if (err) { console.error('error outputting debug'); }
		});
	},
	load_config : function() {
		var d = u.deferred();
		if (fs.existsSync(config_file)) { 
			fs.readFile(config_file, 'utf8', function (err, data) {	
				if (err) { d.reject(err); return; } 
				data = JSON.parse(data);
				d.resolve(data);
			});
		} else {
			this.debug('no config file ', config_file);
			d.resolve({});
		}
		return d.promise();
	}
});

if (require.main === module) { new NodeService(); }