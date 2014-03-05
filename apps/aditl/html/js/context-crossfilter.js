
// ::: ::: 
// for each landmark item
//    day of week 
//    -> raw context observations -> 
//    groupBy DOW :: (monday/tuesday/wednesday/thursday/friday)
//    groupBy HoD :: (...)
//    groupBy Landmark :: (...)

angular.module('aditl')
    .factory('context-crossfilter', function($scope, client, entities) {
        // builds a crossfilter of all the activities/contexts 
            var cf, u = utils,
                urlDomain = function(d) { 
                    var url = new URL(d),
                        host = url.hostname,
                        trailing = host.split('.').slice(-2).join('.');
                    return trailing;
                },             
                dimensions = [
                    { name: 'what', f: function(d) { return d.peek('what') && d.peeK('what').id || 'none'; } },
                    { name: 'activity', f: function(d) { return d.peek('activity') || 'none'; },
                    { name: 'domain', f : function(d) { return (d.peek('what') && urlDomain(d.peeK('what').id)) || 'none'; }, show:true },
                    { name: 'duration', f : function(d) { return d.tend.valueOf() - d.tstart.valueOf(); }, },
                    { name: 'start', f : function(d) { return d.tend.valueOf(); }, type:'discrete'},
                    { name: 'end', f : function(d) { return d.tstart.valueOf(); }, type:'discrete'},
                    { name: 'date', f : function(d) { return topOfDay(d.tstart).valueOf().toString(); }, colsize:'thin',
                        facetformat: function(val) {
                            // val coming in will be a string
                            var tod = topOfDay(new Date(+val));
                            if (tod == today) { return 'Today'; }
                            if (tod == yesterday) { return 'Yesterday'; }
                            return d3.time.format('%a %d/%m')(tod);
                        }, show: true}
                ],
                sa = function(f) { utils.safeApply($scope, f); }, 
                guid = u.guid(), 
                topOfDay = function(d) { 
                    var day = new Date(d.valueOf());
                    day.setHours(0); day.setMinutes(0); day.setSeconds(0); day.setMilliseconds(0); // midnight
                    return day;
                }, 
                load_box = function(box) {
                    entities.activities.getByActivityType(box).then(function(events){
                        crossfilter = crossfilter(events);
                        sa(function() { $scope.events_count = events.length }); // set some feedback
                        init_cf(expanded);
                    });
                }, set_box = function(box) { 
                    cf = undefined;
                    if (old_box) { old_box.off(undefined, undefined, guid); }
                    $scope.dimensions = [];
                    box.on('obj-add', function(evtid) {
                        if (evtid.indexOf('activity') === 0 && evtid.indexOf('browse') > 0) {
                            sa(function() { $scope.event_count++; });
                            box.getObj(evtid).then(function(evtm) { add_event(evtm); });
                        }
                    }, guid);
                    old_box = box;
                    load_box(box);
                };
            window.$f = $scope;
            return {
                set_box: set_box
            };
        }).controller('context-correlation', function($scope) { 

        var margin = {top: 20.5, right: -.5, bottom: 9.5, left: 20.5},
            width = 720,
            height = 720;

    var n = 60,
        m = 10000,
        zero = d3.range(n).map(function() { return 0; }),
        matrix = zero.map(function() { return zero.slice(); });

    var x = d3.scale.ordinal()
        .domain(d3.range(n))
        .rangeBands([0, width]);

    var z = d3.scale.linear()
        .domain([m / n / 3, m / n, m / n * 3])
        .range(["brown", "#ddd", "darkgreen"])
        .clamp(true);

    var svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("margin-left", -margin.left + "px")
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height);

    var row = svg.selectAll(".row")
        .data(matrix)
      .enter().append("g")
        .attr("class", "row")
        .attr("transform", function(d, i) { return "translate(0," + x(i) + ")"; });

    row.selectAll(".cell")
        .data(function(d) { return d; })
      .enter().append("rect")
        .attr("class", "cell")
        .attr("x", function(d, i) { return x(i); })
        .attr("width", x.rangeBand())
        .attr("height", x.rangeBand());

    row.append("line")
        .attr("x2", width);

    row.append("text")
        .attr("x", -6)
        .attr("y", x.rangeBand() / 2)
        .attr("dy", ".32em")
        .attr("text-anchor", "end")
        .text(function(d, i) { return i; });

    var column = svg.selectAll(".column")
        .data(matrix)
      .enter().append("g")
        .attr("class", "column")
        .attr("transform", function(d, i) { return "translate(" + x(i) + ")rotate(-90)"; });

    column.append("line")
        .attr("x1", -width);

    column.append("text")
        .attr("x", 6)
        .attr("y", x.rangeBand() / 2)
        .attr("dy", ".32em")
        .attr("text-anchor", "start")
        .text(function(d, i) { return i; });