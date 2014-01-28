
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	jQuery = require('jquery'),
	path = require('path'),
	nodeservice = require('./nodeservice');

var TestRunnerService = Object.create(nodeservice.NodeService, {
	run: { // ecmascript 5, don't be confused!
		value: function(store) {
			console.log('trying to work')
			var this_ = this;
			this.load_config().then(function(config) {
				this_.debug('config! ', config, typeof config, config);
				if (!config || !_(config).keys()) {
					this_.debug(' no configuration set, aborting '); 
					return;
				} else {
					var boxid = config.box;
					store.getBox(boxid).then(function(box) {
						console.log('GOT THE BOX')
						
					}).fail(function(err) { this_.debug('error getting box ', err); });
			}
		}).fail(function(err) { console.error('error loading config', err); });
	}}
});

if (require.main === module) { 
	var ws = Object.create(TestRunnerService);
	ws.init();
}