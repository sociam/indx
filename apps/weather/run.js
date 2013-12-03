
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	jQuery = require('jquery'),
	path = require('path'),
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	nodeservice = require('./nodeservice');

if (require.main === module) { new nodeservice.NodeService(); }