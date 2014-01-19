
// test
var nodeindx = require('./nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	fs = require('fs'),
	jQuery = require('jquery'),
	path = require('path');

var output = function(jsonobj) { console.log(JSON.stringify(jsonobj));};

var NodeService = { 
	init:function(moduledir) { 
		var d = u.deferred(), this_ = this;
		this.config_file_path = path.resolve(moduledir,'.config.json');
		this.debug_log_path = path.resolve(moduledir,'.debug.log');
		// this.check_args();
		this.load_config().then(function(config) { 
			this_.config = config;
			d.resolve();
		}).fail(function() { 
			// couldn't load config. that's okay - might be our first run
			output({message:"couldnt-load-config"});
			d.resolve();
		});
		return d.promise();
	},
	assert:function(test, message, errortype) {
		if (!test) {
			console.error(message);
			output({event:'error', type:errortype, message:message});
			process.exit(-1);
		}
	},
	setHost:function(host) { this.host = host; },
	// takes care of getconfig/setconfig arguments from indx
	check_args: function() {
		var argv = require('optimist').argv, this_ = this;
		if (argv.getconfig) {
			output(this.config || {});
		} else if (argv.setconfig) {
			try{ 
				var jsonconfig = JSON.parse(argv.setconfig);
				this.save_config(jsonconfig).then(function() { 
					output({status:200,message:"ok - configuration saved"});
				}).fail(function(f) {
					console.error(f);
				});
			} catch(e) {
				console.error("error parsing config json ", argv.set_config);
			}
		} else {
			// run mode
			if (!argv.indxhost) {
				output({message:"argument-error", message:"no indx server specified; use --indxhost"});
				console.error('no indx server specified; use --indxhost'); 
				return;
			} 
			var config = this.config;
			this.setHost(argv.indxhost);
			console.debug('RUN load config --- ', this.host, config, typeof(config), config.length);
			console.debug('----------');
			this.login().then(function(store) { this_.run(store); }).fail(function() { console.error('fail logging :('); });
		}
	},
	login:function() { 
		this.assert(this.host, "No host specified", "config-error");
		this.assert(this.config.user , "No username stored in config", "config-errpr");
		this.assert(this.config.password, "No password stored in config", "config-error");
		return nodeindx.login(this.host,this.config.user,this.config.password); 
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
		var pretty = JSON.stringify(config, null, 4), d = u.deferred(), this_ = this;
		fs.writeFile(this.config_file_path, pretty, function(err) { 
			if(err) { 
				this_.debug('error saving file ', this_.config_file_path); 
				return d.reject(err); 
			} 
			output({message:"config-updated", data:config});
			d.resolve();
		}); 
		return d.promise();
	},
	debug : function() {
		console.debug.apply(console,arguments);
		var argstr = _(arguments).toArray().map(function(x) { return x ? x.toString() : ''; });
		fs.appendFile(this.debug_log_path, (new Date()).toString() + ' - ' + argstr.join(' ') + '\n', function(err) { 
			if (err) { console.error('error outputting debug'); }
		});
	},
	load_config : function() {
		var d = u.deferred();
		if (fs.existsSync(this.config_file_path)) { 
			fs.readFile(this.config_file_path, 'utf8', function (err, data) {
				if (err) { console.error('rejecting with err -- '); d.reject(err); return; } 
				return d.resolve(JSON.parse(data));
			});
		} else {
			this.debug('no config file ', this.config_file_path);
			return d.resolve({});
		}
		return d.promise();
	}
};

module.exports = {
	NodeService:NodeService,
	output:output
};

if (require.main === module) { 
	var ns = Object.create(NodeService);
	ns.init(path.dirname(module.filename)).then(function() { ns.check_args(); });
}