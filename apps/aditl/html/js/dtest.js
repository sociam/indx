/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery,d3 */


var svg, 
	width=500, height=700, 
	xs = d3.scale.linear().range([0,width]),
	ys = d3.scale.linear().range([height,0]),
	smult = 1.0,
	xsoff = 0,
	points = [];

var init = function() { 
	svg = d3.select('.row').append('svg').attr('width',width).attr('height',height);

	for (var i = 0; i < 100; i++) {
		points.push({ x:Math.random()*100, y:Math.random()*10, size:Math.random()*10+1 });
	}

	xs.domain([0, 
		d3.extent(points.map(function(x) { return x.x; }))[1]]);

	ys.domain(d3.extent(points.map(function(x) { return x.y; })));
};

var plot = function() { 
	console.log('plotting ... ', points);
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

jQuery(document).ready(function() {
	init();
	plot();
	$('.domainoffset').on("input change", function(val) { 
		console.log('value -- ', val, $('.domainoffset').val());
		xsoff = $('.domainoffset').val();
		$('.domainout').html('[0, '+xsoff+']');
		xs.domain([0, xsoff]);
		plot();
	});
	$('.sizemult').on("input change", function(val) { 
		smult = $('.sizemult').val();
		plot();
	});

});

