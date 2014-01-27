  	
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
	jQuery = require('jquery'),
	path = require('path'),
	simpleweather = require('./jquery.simpleWeather').load(jQuery),
	nodeservice = require('../../lib/services/nodejs/service');

var WeatherService = Object.create(nodeservice.NodeService, {
	run: { 
		value: function(store) {
			// run continuously
			var this_ = this, config = this.load_config();
			this.store = store;
			console.debug('Will fetch every ', config.sleep || 60000, 'ms');
			var fetch = function() { 
				console.debug('Fetching weather ');
				this_.get_weather(store);
			};
			fetch();
			setInterval(fetch, config.sleep || 60000);
		}
	},
	get_weather: { // ecmascript 5, don't be confused!
		value: function(store) {
			var this_ = this;
			this.load_config().then(function(config) {
				// this_.debug('config! ', config, typeof config, JSON.parse(config));
				config = JSON.parse(config);
				if (!config || !_(config).keys()) {
					this_.debug(' no configuration set, aborting '); 
					return;
				} else {
					var boxid = config.box;
					store.getBox(boxid).then(function(box) {
						var sleep = config.sleep, loc = config.latlngs;
						this_.debug('configured for ', loc, ' sleeping ', sleep, 'msec ');
						var sleepmsec = parseInt(sleep,10), locs = loc.split(' ').map(function(x) { return x.split(','); });
						var lat = locs[0][0], lon = locs[0][1];
						jQuery.get('http://api.openweathermap.org/data/2.5/weather?' + jQuery.param({lat:lat,lon:lon,units:'metric', format:'json'}))
							.then(function(json) { 
								this_.debug('Fetched and unpacked weather >> - id:', json.id, ' - dt ', json.dt);
								var weatherid = 'weather-report-'+json.id+'-'+json.dt;
								u.when([
									this_._unpack(json,box),
									box.getObj(weatherid)
								]).then(function(wobj) {
									var unpacked = wobj[0], weather = wobj[1];
									weather.set(unpacked);
									weather.save().then(function() {
										this_.debug('successfully saved weather ', weatherid);
									}).fail(function(err) { console.error('error saving weather', err); });
								});	
							}).fail(function(err) {
								console.log(err);
							});
					}).fail(function(err) { this_.debug('error getting box ', err); });
			}
		}).fail(function(err) { console.error('error loading config', err); });
	}},
	_unpack: {
		value: function(c, box) {
			var w = {}, d = u.deferred();
			w.latlng = [c.coord.lat, c.coord.lon];
			w.sunrise = new Date(c.sys.sunrise*1000);
			w.sunset = new Date(c.sys.sunset*1000);
			_(w).extend(c.main);
			w.windspeed = c.wind.speed;
			w.winddir = c.wind.deg;
			w.clouds = c.clouds.all;
			w.location = c.name;
			w.country = c.sys.country;
			w.source = 'openweathermap.org';
			w.type = 'weather-report';
			w.time = c.dt;
			w.when = new Date(c.dt*1000);
			w.wid = c.id;
			w.code = c.code;
			if (c.weather) { 
			var weatherconditionid = 'weather-condition-'+c.weather[0].id;
				box.getObj(weatherconditionid).then(function(wcobj) {
					wcobj.set(c.weather[0]);
					wcobj.save();
					d.resolve(w);
				}).fail(d.reject);
			}
			return d.promise();
		}
	}
});

if (require.main === module) { 
	var ws = Object.create(WeatherService);
	ws.init(path.dirname(module.filename));
}