
// test
var nodeindx = require('./nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	fs = require('fs'),
	jQuery = require('jquery'),
	path = require('path');

var NodeService = { 
	init:function(moduledir) { 
		this.config_file_path = path.resolve(moduledir,'.config.json');
		this.debug_log_path = path.resolve(moduledir,'.debug.log');
		this._check_args();
	},
	// takes care of getconfig/setconfig arguments from indx
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
		var pretty = JSON.stringify(config, null, 4), d = u.deferred(), this_ = this;
		fs.writeFile(this.config_file_path, pretty, function(err) { 
			if(err) { 
				this_.debug('error saving file ', this_.config_file_path); 
				return d.reject(err); 
			} 
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
				if (err) { d.reject(err); return; } 
				data = JSON.parse(data);
				d.resolve(data);
			});
		} else {
			this.debug('no config file ', this.config_file_path);
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