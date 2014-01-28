/* jshint browser: true, console: true */
(function (root, $) {
	'use strict';

	var fileCache = {};

	root.showSource = function (file, line) {
		if (fileCache[file]) {
			root.openFilePane(fileCache[file], line);
		} else {
			$.get(file, function (data) {
				fileCache[file] = data;
				root.openFilePane(data, line);
			});
		}
	};

	root.openFilePane = function (data, line) {
		console.log(data, line);
	};


	var $sidebar, $body, $mainbody;

	$(function () {
		route();
		$('table').addClass('table'); // fixme
		$sidebar = $('.sidebar');
		$body = $('body');
		$mainbody = $('.mainbody');
	});

	$(window)
		.on('hashchange', function () {
			route();
		});

	var route = function () {
		var hash = window.location.hash.substr(1),
			sections = hash.split('I'),
			type = sections.shift() || 'overview',
			section = ['file', 'api', 'overview'].indexOf(type) > -1,
			name = sections.shift(),
			selector = (section ? 'section' : '') + '.' + type;


		if (name) {
			selector += '#' + name;
		}

		var $section = $(selector);
		if (!$section.length) {
			window.location.hash = '';
			return;
		}
		if (!section) {
			$section = $section.parents('section');
			console.log('s2', $section)
		}

		$('section').hide();
		$section.show();


		$('nav li').removeClass('active');
		setTimeout(function () {
			var showSidebar = false;
			$('section:visible').each(function () {
				var $el = $(this);
				$el.attr('class').split(' ').forEach(function (cls) {
					var selector = 'nav li.nav-' + cls;
					if ($el[0].id) {
						selector += 'I' + $el.id;
					}
					$(selector).addClass('active');
				});
				if ($el[0].id) {
					var $sec = $('section#sidebar-' + this.id);
					if ($sec) {
						$sec.show();
						showSidebar = true;
					}
				}
			});
			$body.scrollTop($(selector).offset().top - 80);
			$sidebar.toggle(showSidebar);
			$mainbody.css('margin-left', showSidebar ? 300 : 30);

			//$sidebar.scrollTop($el.filter(sidebarSelector).offset().top - 80);
		}, 0);

	};
}(this, this.jQuery));