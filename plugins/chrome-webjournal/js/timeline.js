function _timegraph() {
    var TimeGraph = Backbone.View.extend(
        {
            tagName:"div",
            className:"graph",
            width:500,
            height:400,
            initialize:function() {
                log("init ", this.width, this.height, this.el);
                this.r = Raphael(this.el, this.width, this.height);
                var this_ = this;
                setInterval(function(x) {   this_.render();    }, 200);
            },
            render:function() {
                var this_ = this;
                var r = this.r;
                r.clear();                
                // first sort stream
                var destinations = this.options.stream.get_unique("to");
                var n_rows = destinations.length;
                var row_height = this_.height/(n_rows + 1);

                //var rect = r.rect(0,0,this.width,this.height);
                //rect.attr({stroke:"red"});                
                
                var all = this_.options.stream.get_sorted_by_start();
                
                if (all.length == 0) {
                    console.log("length = 0 :( ");
                    return this;
                }

                // window.ALL = all;                
                var start_t = all[0].get("start").valueOf();
                var end_t = new Date().valueOf();

                var line_path = function(coords) {
                    return coords.map(function(x) { return "L"+x.join(",") + " "; });
                };

                var i = 0;
                var titles = [];
                var paths = destinations.map(
                    function(destination) {
                        if (destination.trim().length == 0) { return undefined; }

                        var toevts = this_.options.stream.get_sorted_by_start(undefined,destination);
                        var y = Math.floor((i+1)*(this_.height/(n_rows)));

                        var title = destination.length > 50 ? destination.substr(0,50) + "... " : destination;
                        titles.push( r.text(this_.width-20,y-(row_height/2.0),title));
                        var topath = "M"+[0,y].join(",");                        

                        toevts.map(function(evt) {
                                       var xs = Math.floor(this_.width * (evt.get("start").valueOf() - start_t)/(end_t - start_t));
                                       if (_.isNaN(xs)) {
                                           console.error("OMGGGGGGGGGGGGGGG - ", evt, evt.get("start"));
                                       }
                                       var xe = Math.floor(this_.width * ((evt.get("end") !== undefined ? evt.get("end").valueOf() : new Date().valueOf()) - start_t)/(end_t - start_t));
                                       topath += line_path([[xs,y],[xs,y-row_height],[xe,y-row_height],[xe,y]]);
                                   });

                        topath += line_path([[this_.width,y]]);
                        i++;
                        return r.path(topath);
                    });
                titles.map(function(x) {
                               x.attr({color:"black",opacity:1.0,"font-size": "12pt", "text-anchor" : "end",
                                       "font-family":"helvetica neue,helvetica,arial"});
                           });
                paths.filter(function(x) { return x !== undefined; }).
                    map(function(x) {
                            x.attr({stroke:"black",opacity:0.5});
                        });
                return this;
            }
        }
    );
    return {
        TimeGraph:TimeGraph
    };
}