/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery,d3 */


var svg, 
	width=500, height=700, 
	xs, ys,
	extentsx, extentsy,
	smult = 1.0,
	xsoff = 0, ysoff = 0,
	points = [],
	tx, ty;

var init = function() { 
	width = $(document).width()-5;
	height = $(document).height()-5;
	console.log('width >> ', width, ' height ', height);
	xs = d3.scale.linear().range([0,width]);
	ys = d3.scale.linear().range([height,0]);	

	svg = d3.select('body').append('svg').attr('width',width).attr('height',height);

	for (var i = 0; i < 100; i++) {
		points.push({ x:Math.random()*1000, y:Math.random()*1000, size:Math.random()*10+1 });
	}

	extentsx = d3.extent(points.map(function(x) { return x.x; }));
	extentsy = d3.extent(points.map(function(x) { return x.y; }));

	xs.domain([0, extentsx[1]]);
	ys.domain([0, extentsy[1]]);
};

var plot = function() { 
	svg.selectAll('.bubble')
		.data(points)
		.enter()
		.append('circle')		
		.attr('class', 'bubble');
	svg.selectAll('.bubble')
		.attr('r', function(d) { return smult*d.size; })
		.attr('cx', function(d) { return xs(d.x); })
		.attr('cy', function(d) { return ys(d.y); });
};

document.ontouchmove = function(e){ e.preventDefault(); }

jQuery(document).ready(function() {
	init();
	plot();

	$('body').on('touchmove', function(evt) {
		console.log('touchmove');
		var nx = evt.originalEvent.touches[0].clientX, 
			ny = evt.originalEvent.touches[0].clientY;
		if (tx !== undefined && ty !== undefined) {
			var sx = nx - tx, sy = ny - ty;
			xsoff -= sx;
			ysoff += sy;
			xs.domain([xsoff, extentsx[1]+xsoff]);
			ys.domain([ysoff, extentsy[1]+ysoff]);
			plot();
		}
		tx = nx; 
		ty = ny;
	});
	$('body').on('touchstart', function(evt) { 
		console.log('touchstart');
		tx = evt.originalEvent.touches[0].clientX;
		ty = evt.originalEvent.touches[0].clientY;
	});	
	$('body').on('touchend', function(evt) { console.log('touchend'); tx = undefined; ty = undefined; });

	setInterval(function() { 
	 	points.map(function(p) { 
	 		p.x += (Math.random()); 
	 		p.y += (Math.random()); p.size = Math.max(1.0, p.size + (Math.random()));
	 	 });
		plot();	 	
	}, 10);

	// $('.domainoffset').on("input change", function(val) { 
	// 	console.log('value -- ', val, $('.domainoffset').val());
	// 	xsoff = $('.domainoffset').val();
	// 	$('.domainout').html('[0, '+xsoff+']');
	// 	xs.domain([0, xsoff]);
	// 	plot();
	// });
	// $('.sizemult').on("input change", function(val) { 
	// 	smult = $('.sizemult').val();
	// 	plot();
	// });

});

