charts = {};

charts.sparkline = function() {
  // basic data
  var margin = {top: 0, bottom: 50, left: 0, right: 0},
      width = 900,
      height = 400,
      //accessors
      xValue = function(d, i) { return i; },
      yValue = function(d) { return d; },
      // chart underpinnings
      x = d3.scale.ordinal(),
      y = d3.scale.linear(),
      // chart enhancements
      elastic = {
        x: true,
        y: true
      },
      convertData = true,
      duration = 500,
      formatNumber = d3.format(',d');

  function render(selection) {
    selection.each(function(data) {
      // setup the basics
      var w = width - margin.left - margin.right,
          h = height - margin.top - margin.bottom;

      if (convertData) {
        data = data.map(function(d, i) {
          return {
            x: xValue.call(data, d, i),
            y: yValue.call(data, d, i)
          };
        });
      }
      // set scales
      if (elastic.x) x.domain(data.map(function(d) { return d.x; }));
      if (elastic.y) y.domain([d3.min(data, function(d) { return d.y}), d3.max(data, function(d) { return d.y; })]);
      console.log("data", data)
      console.log("bounds", x.domain(), y.domain())
      x.rangeRoundBands([0, w], .1);
      y.range([h, margin.bottom]);

      var line = d3.svg.line()
        .x(function(d) { return x(d.x) })
        .y(function(d) { return y(d.y) })
        .interpolate("basis")

      var svg = selection.selectAll('svg').data([data]);
      var chartEnter = svg.enter()
        .append('svg')
          .attr('width', w)
          .attr('height', h)
        .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
          .classed('chart', true);
      var chart = svg.select('.chart');


      path = chart.selectAll('.path').data([data]);

      path.enter()
        .append('path')
          .classed('path', true)
          .attr('d', line)

      path.transition()
        .duration(duration)
          .attr('d', line)

      path.exit()
        .transition()
        .duration(duration)
        .style('opacity', 0)
        .remove();
    });
  }

  // basic data
  render.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return render;
  };
  render.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return render;
  };
  render.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return render;
  };

  // accessors
  render.xValue = function(_) {
    if (!arguments.length) return xValue;
    xValue = _;
    return render;
  };
  render.yValue = function(_) {
    if (!arguments.length) return yValue;
    yValue = _;
    return render;
  };

  render.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return render;
  };
  render.y = function(_) {
    if (!arguments.length) return y;
    y = _;
    return render;
  };

  // chart enhancements
  render.elastic = function(_) {
    if (!arguments.length) return elastic;
    elastic = _;
    return render;
  };
  render.convertData = function(_) {
    if (!arguments.length) return convertData;
    convertData = _;
    return render;
  };
  render.duration = function(_) {
    if (!arguments.length) return duration;
    duration = _;
    return render;
  };
  render.formatNumber = function(_) {
    if (!arguments.length) return formatNumber;
    formatNumber = _;
    return render;
  };

  return render;
};