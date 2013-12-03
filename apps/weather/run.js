
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	jQuery = require('jquery'),
	path = require('path'),
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	nodeservice = require('./nodeservice');

var WeatherService = Object.create(nodeservice.NodeService, {
	run: { // ecmascript 5, don't be confused!
		value: function(store) {
			this.get_config().then(function(config) {
				if (!config || !_(config).keys()) {
					this_.debug(' no configuration set, aborting '); 
					return;
				} else {
					var sleep = config.sleep, loc = config.latlng;
					this_.debug('configured for ', loc, ' sleeping ', sleep, 'msec ');
					var sleepmsec = parseInt(sleep,10), locs = loc.split(' ').map(function(x) { return x.split(','); });
					this_.debug('locs ', locs, ' sleeping ', sleepmsec, 'msec ');
				}
			}).fail(function() {this_.debug('error getting config ');});
		}
	}
});

if (require.main === module) { 
	var ws = Object.create(WeatherService);
	ws.init();
}