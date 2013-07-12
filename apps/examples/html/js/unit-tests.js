describe('WebBox-Backbone', function () {
	describe('load', function () {
		var loaded;
		it('should load the javascript dependancies', function () {
			runs(function () {
				loaded = false;
				WebBox.load().then(function () {
					loaded = true;
				});
			});
			waitsFor(function () {
				return loaded;
			}, 'Didn\'t load', 2000);
			runs(function () {
			});
		});
		describe('Store', function () {
			var store;
			beforeEach(function() {
				store = new WebBox.Store();
			});
			it('should be able to authenticate', function () {

			});
		});
	});
});

(function() {
	var jasmineEnv = jasmine.getEnv();
	jasmineEnv.updateInterval = 250;

	var htmlReporter = new jasmine.HtmlReporter();
	jasmineEnv.addReporter(htmlReporter);

	jasmineEnv.specFilter = function(spec) {
		return htmlReporter.specFilter(spec);
	};

	var currentWindowOnload = window.onload;
	window.onload = function() {
		if (currentWindowOnload) {
			currentWindowOnload();
		}
		execJasmine();
	};

	function execJasmine() {
		jasmineEnv.execute();
	}
})();


/*function AppController($scope) {

	_($scope).extend({ loading:0, inputmodel:'' });

	WebBox.load().then(function() {
		var store = new WebBox.Store(), model = new Backbone.Model();
		u = WebBox.utils;
		window.store = store;
		store.login(params.username,params.password).then(function() {
			var box = store.get_or_create_box(params.database);
			var next = function() {
				box.get_obj('example1').then(function(o) {
					model = o;
					$scope.update = function() {
						model.set({value: $scope.inputmodel}, {silent:true});
						try { model.save(); } catch(err) { console.error(err); }
					};

					var update_view = function() {
						var val = model.get('value') !== undefined ? model.get('value')[0] : undefined;
						if (val === $scope.inputmodel) { return; }
						$scope.$apply(function() {	$scope.inputmodel = val; });
					};
					model.on('change:value', update_view);
					update_view();
				});
			};
			box.fetch().then(next).fail(function(status) {
				// if it fails then might be that we haven't created the box yet
				u.debug('status >>>> ', status);
				box.save().then(next);
			});
			window.box = box;
		});

	});

}
*/
