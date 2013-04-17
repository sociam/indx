/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true, sloppy:true */

var safe_apply = function($scope, fn) {
	if ($scope.$$phase) { return fn(); }
	$scope.$apply(fn);
};


var app = angular
	.module('tests', ['ui', 'webbox-widgets'])
	.factory('webboxdrv',function() {
		var exports = {};
		var d = exports.loaded = new $.Deferred();
		WebBox.load().then(function() {
			$('#loader').fadeOut('slow');			
			exports.u = window.u = WebBox.utils;
			var store = exports.store = window.store = new WebBox.Store();
			store.on('login', function() { console.log('log in ok'); });
			store.toolbar.on('change:box', function(b) {
				if (b !== undefined) {
					var box = store.get_box(b);
					box.fetch().then(function() {
						console.log('loaded --- ', box);
						store.trigger('box-loaded', box);
					});
				}
			});			
			d.resolve(exports);
		});
		return exports;
	});


function BoxView($scope, webboxdrv) {
	var box, u;
	
	$scope.delete = function(id) {
		box.get_obj(id).then(function(obj) {
			obj.destroy()
				.then(function() { console.log("DONE DELETING ", obj.id); })
				.fail(function(err) { console.error('ERROR DELETING', obj.id, err); });
		});
	};

	var update_els_list = function() {
		if (box === undefined) { return; }
		u.debug('updating elements ', box.get_obj_ids().length );
		safe_apply($scope, function() {
			$scope.box_object_ids = box.get_obj_ids();
			u.when(box.get_obj_ids().map(function(id) { return box.get_obj(id); })).then(function() {
				// then save a reference
				$scope.box_objects = _(box._objcache()).clone();
			});
		});
	};

	$scope.showEditor = {};
	$scope.toggleEditor = function(edid) {
		$scope.showEditor[edid] = !$scope.showEditor[edid];
	};	
	
	webboxdrv.loaded.then(function() {
		var store = webboxdrv.store;
		u = window.u = webbox.u;
		store.on('box-loaded', function(_box) {
			if (box !== undefined) { box.off(); }
			box = _box;
			console.log('box loooooooooaded ', box.id);
			safe_apply($scope, function() { $scope.box = box; });
			update_els_list();			
			box.on('obj-add obj-remove', function() { update_els_list(); });			
		});		
	});

}

$('#loader').width($(document).width());

