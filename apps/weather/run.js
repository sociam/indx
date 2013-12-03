
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	jQuery = require('jquery'),
	path = require('path'),
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	nodeservice = require('./nodeservice');

var WeatherService = Object.create(nodeservice.NodeService, {
	run:{ 
		value: function(store) {
			this.debug(' weather ran instead!! ', store);
		}
	}
});

if (require.main === module) { 
	var ws = Object.create(WeatherService);
	ws.init();
}