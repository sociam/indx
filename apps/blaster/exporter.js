/* jshint undef: true, strict:false, trailing:false, unused:false, quotmark:false */
/* global require, exports, console, process, module */

// laura's lovely code ported to this thing

(function() { 

	var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    	nodeservice = require('../../lib/services/nodejs/service'),
	    u = nodeindx.utils,
	    _ = require('underscore'),
	    jQuery = require('jquery'),
	    format = 'json';

	var file_formats = {
		'json' : 'json',
		'jsonld' : 'jsonld',
		'ntriples' : 'nt', 
		'csv' : 'csv'
	};

	var literalDeserialisers = {
		'': function(v) { return v; },
		'http://www.w3.org/2001/XMLSchema#integer': function(v) { return parseInt(v, 10); },
		"http://www.w3.org/2001/XMLSchema#float": function(v) { return parseFloat(v, 10); },
		"http://www.w3.org/2001/XMLSchema#double": function(v) { return parseFloat(v, 10); },
		"http://www.w3.org/2001/XMLSchema#boolean": function(v) { return v.toLowerCase() === 'true'; },
		"http://www.w3.org/2001/XMLSchema#dateTime": function(v) { return new Date(Date.parse(v)); }
	};

	var serialisers = {
		'json' : function(obs,box) {
			console.log("serializing list to json");
			var ids = Object.keys(obs);
			var newobs = ids.map(function(oid) {
				console.log("processing object ",obs[oid]);
				var obj = obs[oid];
				var newobj = {};
				var keys = Object.keys(obj);
				for (var i in keys) {
					newobj[keys[i]] = parseValue(obj[keys[i]]);
				}
				return newobj;
			});
			return JSON.stringify(newobs);
		},
		'jsonld' : function(obs,box) {
			console.log("serializing list to json-ld");
			// create a context for the list, containing as base/vocab? the url of the server/box
			var out = {};
			out["@context"] = createContextObj(box); // TODO 
			// save the box as a graph? with @graph? or not needed ...	
			var ids = Object.keys(obs);
			out["@graph"] = ids.map(function(oid) {
				console.log("processing object ",obs[oid]);
				var obj = obs[oid];
				var newobj = {};
				var keys = Object.keys(obj);
				for (var i in keys) {
					var key = keys[i];
					var val = obj[keys[i]];
					if (Array.isArray(val)) {
						var newVal = val.map(function(o) {
							if (o.hasOwnProperty("@id")) {
								return {"@id":o["@id"]};
							} else {
								return o;
							}
						});
						newobj[key] = newVal;
					} else {
						newobj[key] = val;
					}
				}
				return newobj;
			});				
			return JSON.stringify(out);	
		},
		'ntriples' : function(obs,box) {
			console.log("serializing list to turtle");
			var defaultPrefix = "@prefix : <http://"+box.store.get('server_host')+"/"+box.getID()+"/"+"> .\n";
			var rdfsPrefix = "@prefix rdfs : <http://www.w3.org/2000/01/rdf-schema#> . \n";
			return defaultPrefix + rdfsPrefix + "\n"+ toN3(obs);
		}, 
		'csv' : function(obs,box) {
			console.log("serializing list to csv");
			return toCSV(obs);
		}
	};

	var toCSV = function(obs) {
		var ids = Object.keys(obs);
		var cols=["@id"];
		ids.map(function(oid) {
			var keys = Object.keys(obs[oid]);
			for (var i in keys) {
				var key = keys[i];
				if (cols.indexOf(key) == -1) {
					cols.push(key);
				}
			}
		});
		var rows = ids.map(function(oid) {
			var obj = obs[oid];
			var row = [];
			for (var i in cols) {
				if (obj.hasOwnProperty(cols[i])) {
					var val = parseValue(obj[cols[i]]);
					if (Array.isArray(val) && (val.length > 1)) {
						row.push('"['+val.toString()+']"');
					} else {
						row.push('"'+val.toString()+'"');
					}
				} else {
					row.push("");
				}
			}
			return row;
		});
		return cols + "\n" +rows.join("\n");
	};

	var toN3 = function(obs) {
		var ids = Object.keys(obs);
		var triples = ids.map(function(oid) {
			var obj = obs[oid];
			var objTriples = [":"+oid+" a rdfs:Resource"];
			var keys = Object.keys(obj);
			for (var i in keys) {
				var key = keys[i];
				if (key != "@id") {
					console.log(obj[key]);
					if (Array.isArray(obj[key])) {
						var values = obj[key].map(function(o) {
							if (o.hasOwnProperty("@id")) {
								return ":"+o["@id"]; // make this check when it's a absolute or relative url
							} 
							if (o.hasOwnProperty("@value")) {
								return "\""+o["@value"]+"\"";
							}
						});
						objTriples.push("\t :"+key + " "+values.toString());
					} else {
						objTriples.push("\t :"+ key+ " "+ parseValue(obj[key]).toString());
					}
				}
			}
			return objTriples.join(";\n") + " .";
		});
		return triples.join("\n");
	};

	var exportBox = function(box,format) {
		var d = u.deferred();
		box.query({}, "*").then(function(response) {
			var objects = response.data;
			d.resolve(serialisers[format](objects));
		}).fail(d.reject);
		return d.promise();
	};
	var exportObj = function(box,objid,format) {
		var d = u.deferred();
		box.query({"@id":objid}, "*").then(function(response) {
			var objects = response.data;
			d.resolve(serialisers[format](objects,box));
		}).fail(d.reject);
		return d.promise();
	};
	var createContextObj = function(box) {
		var context = {};
		// what is the box url in indx? 
		context.vocab=box.store.get('server_host')+"/box/"+box.getID()+"/";
		// what else should go in context? 
		return context;
	};

	var parseValue = function(val) {
		if (Array.isArray(val)) {
			return val.map(function(o) {
				if (o.hasOwnProperty("@id")) {
					return o["@id"];
				} 
				if (o.hasOwnProperty("@value")) {
					return literalDeserialisers[o["@type"]](o["@value"]);
				}
			});
		} else {
			return val;
		}
	};

	module.exports = {
		exportBox:exportBox,
		exportObj:exportObj
	};

})();