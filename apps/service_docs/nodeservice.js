// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	fs = require('fs'),
	jQuery = require('jquery'),
	path = require('path'),
	config_file = path.resolve(__dirname, '.config.json'),
	debugfilename = path.resolve(__dirname, '.debug.log');

var passwordPlaceholder = "********"; // don't send password back to client

var NodeService = { 
	init:function() {
		var that = this;
		this.load_config().then(function (config) {
			that.config = config;
			that._check_args();
		});
	},
	_check_args: function() {
		var that = this,
			argv = require('optimist').argv;
		if (argv.getconfig) {
			this.debug('get config');
			try { 
				that.debug('censoring password')
				that.config.password = that.config.password ? passwordPlaceholder : '';
				console.log(JSON.stringify(that.config));
			} catch(e) { 
				that.debug(' error loading config ' + e.toString());
				console.log(JSON.stringify({status:500,message:"error loading config"}));
			}
		} else if (argv.setconfig) {
			this.debug('set config');
			try {
				// load existing config
				var newconfig = JSON.parse(argv.setconfig);
				// replace placeholder with real password
				if (newconfig.password === passwordPlaceholder) { 
					newconfig.password = that.config.password;
				}
				this.save_config(newconfig).then(function() { 
					console.log(JSON.stringify({ status: 200, message: "ok - configuration saved" }));
				}).fail(function(f) {
					console.error(f);
				});
			} catch (e) {
				console.error("error parsing config json ", argv.set_config);
			}
		} else { // run!
			this.debug('starting up >> server -- ', argv.indxhost);
			if (argv.indxhost) {
				nodeindx.login(argv.indxhost, that.config.username, that.config.password).then(function (store) {
					that.run(store);
				}).fail(function() { console.error('fail logging :('); });
			} else {
				console.error('no indx server specified; use --indxhost'); 
			}
		}
	},
	run:function(store) {
		// override me
		var that = this;
		store.getBoxList().then(function(boxids) { 
			that.debug('got boxes >> ', boxids);
			//	store.getBox(bid).then(function(box) { count_props(box); }).fail(function(err) { console.error(err); });
		}).fail(function(err) { that.debug('error > ', err); });
	},
	save_config : function(config) {
		var pretty = JSON.stringify(config, null, 4), d = u.deferred(), that = this;
		fs.writeFile(config_file, pretty, function(err) { 
			if(err) { 
				that.debug('error saving file ', config_file); 
				return d.reject(err); 
			} 
			that.config = config;
			d.resolve();
		}); 
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
		this.debug('load config file', config_file);
		var that = this,
			d = u.deferred();
		if (fs.existsSync(config_file)) { 
			this.debug('config file exists')
			fs.readFile(config_file, 'utf8', function (err, data) {	
				if (err) { 
					that.debug('error loading file', config_file, err);
					d.reject(err); 
					return;
				} 
				that.debug('successfully loaded config');
				data = JSON.parse(data);
				d.resolve(data);
			});
		} else {
			this.debug('no config file ', config_file);
			d.resolve({});
		}
		return d.promise();
	}
};

module.exports = {
	NodeService:NodeService
};

if (require.main === module) { 
	var ns = Object.create(NodeService);
	ns.init();
}