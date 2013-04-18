/*global $,_,document,window,console,escape,Backbone,exports */
/*jslint vars:true, todo:true, sloppy:true */

var safe_apply = function($scope, fn) {
	if ($scope.$$phase) { return fn(); }
	$scope.$apply(fn);
};

var app = angular.module('tests', ['ui', 'webbox-widgets']);

function BoxView($scope, webbox) {
	var box, u;
	
	$scope.delete_object = function(id) {
		box.get_obj(id).then(function(obj) {
			console.log('trying to destroy ', obj);
			window.__todestroy__ = obj;
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
	$scope.toggleEditor = function(edid) { $scope.showEditor[edid] = !$scope.showEditor[edid]; };

	var set_box = function(_box) {
		if (box !== undefined) { box.off(); }
		box = _box;
		safe_apply($scope, function() { $scope.box = box; });
		box.on('obj-add obj-remove', function() { update_els_list(); });
		update_els_list();
	};

	webbox.loaded.then(function() {
		u = webbox.u;
		$('#loader').fadeOut('slow');					
		var store = webbox.store;
		store.toolbar.on('change:box', function(b) {
			if (b !== undefined) {
				var box = store.get_box(b);
				box.fetch().then(function() {
					console.log('loaded --- ', box);
					store.trigger('box-loaded', box);
				});
			}
		});		
		store.on('box-loaded', set_box);
		if (store.toolbar.is_logged_in() && store.toolbar.get_selected_box()) {
			console.log('logged in already setting selected ');
			var sb = store.get_box(store.toolbar.get_selected_box());
			sb.fetch().then(function() { set_box(sb); });
		}
	});

}

$('#loader').width($(document).width());

