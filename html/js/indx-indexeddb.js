/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/* global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */
///  @title indx-offline.js
///  @author Max Van Kleek
///  @since 2014
///  @see http://github.com/sociam/indx
///  @see http://indx.es
///
///  Javascript ORM client for INDX that makes it easy to
///  read and write objects from one or more INDX data store(s).

///  #### Copying
///  Copyright (C) 2011-2013 University of Southampton
///  Copyright (C) 2011-2013 Max Van Kleek
///
///  This program is free software: you can redistribute it and/or modify
///  it under the terms of the GNU Affero General Public License, version 3,
///  as published by the Free Software Foundation.
///
///  This program is distributed in the hope that it will be useful,
///  but WITHOUT ANY WARRANTY; without even the implied warranty of
///  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
///  GNU Affero General Public License for more details.
///
///  You should have received a copy of the GNU Affero General Public License
///  along with this program.  If not, see <http://www.gnu.org/licenses/>.
///

angular
	.module('indx')
	.factory('local',function(utils) {

		// (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)		
		var u = utils, log = utils.log, error = utils.error, debug = utils.debug, jQ = jQuery;
		
		function deleteDB(dbid) {
		    try {

		        var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

		        var dbreq = indexedDB.deleteDatabase(dbid);
		        dbreq.onsuccess = function (event) {
		            var db = event.result;
		            console.log("indexedDB: " + dbid + " deleted");
		        }
		        dbreq.onerror = function (event) {
		            console.error("indexedDB.delete Error: " + event.message);
		        }
		    }
		    catch (e) {
		        console.error("Error: " + e.message);
		        //prefer change id of database to start ont new instance
		        dbid = dbid + "." + fallBackDBGuid;
		        console.log("fallback to new database name :" + dbid)
		    }
		}

		var Store = Backbone.Model.extend({
			getBox:function(bid) { 
				u.assert(bid !== undefined, "box id has to be defined");

				var db = {
			 		id:bid,
			 		description:'indx local store',
				 	migrations: [
				 		{
				 			version:1,
				 			migrate:function(transaction, next){
				 				console.log('migrate >> ', transaction);
				 				var store = transaction.db.createObjectStore(bid);
				 				next();
				 			}
				 		}
				 	]			 			
				 };

			 	var DBModel = Backbone.Model.extend({  
		 			database: db,
			 		storeName:bid
		 		}), 
			 	Collection = Backbone.Collection.extend({ 
			 		database:db,
			 		storeName:bid,
			 		model: DBModel
			 	}), 
			 	d = u.deferred(), 
			 	c = new Collection();

			 	c.fetch().then(function() { d.resolve(c); }).fail(d.reject);

			 	return d.promise();
			}
		});

		return {
			getStore : function() { 
				return new Store(); 
			},
			test : function() { 
				var s = this.getStore();
				s.getBox('a').then(function(box) {
					console.log('box');
					window.box = box;
					console.log('box has ', box.size());
					var ds = [];
					u.range(10).map(function(x) {
						var uid = u.guid(10);
						// var result = box.create({id:uid, test:u.guid(5), message:'hello'});
						var obj = new box.model({id:uid, test:u.guid(5), message:'hello'});
						ds.push(obj.save());
					});
					u.when(ds)
						.then(function(x) { console.log('all done!'); })
						.fail(function(x) { console.error(e); });
				}).fail(function(err) { 
					console.error('couldnt get box '); 
				});
			},
			deleteDB:deleteDB
		};

	});
	