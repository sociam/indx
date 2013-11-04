function _wais() {
    var Person = Backbone.Model.extend({ url: function() { return "http://id.ecs.soton.ac.uk/people/"+this.id; }  });
    var Activity = Backbone.Model.extend({  url: function() {  return "http://id.ecs.soton.ac.uk/activities/"+this.id; }   });
    var Peeps = Backbone.Collection.extend(
        {
            initialize:function() {
                this.by_url = {};
            },
            add:function(g) {
                Backbone.Collection.prototype.add.apply(this,arguments);
                this.by_url[g.url()] = g;
            },
            get_url:function(u) {
                return this.by_url[u];
            }
        });
    var Activities = Backbone.Collection.extend(
        {
            initialize:function() {},
            from:function(whom) {
                if (whom.url) { whom = whom.url(); }
                return this.filter(function(F) {
                                       return F.get("from") == whom;
                                   });
            },
            from_at:function(whom, t) {
                t = t.valueOf();
                return this.from(whom).filter(function(x) {
                                                  return t < x.get("end") && t >= x.get("start"); 
                                              });
            },
            get_unique:function(field) {
                return _(this.map(function(x) { return x.get(field); })).uniq();
            },
            get_sorted_by_start:function(from,to) {
                var t = _(this.models).clone();
                if (from !== undefined) {
                    t = t.filter(function(x) { return x.get("from") == from; });
                }
                if (to !== undefined) {
                    t = t.filter(function(x) { return x.get("to") == to; });
                }
                console.log("t.length",t.length);
                return _(t).sortBy(function(x) { return x.get("start"); });
            }
        });    

    var TimeViz = Backbone.View.extend(
        {
            initialize:function() {
            }
        }
    );                                           
    
    return {
        Person:Person,
        Activity:Activity,
        Peeps:Peeps,
        Activities:Activities
    };        
}