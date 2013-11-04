var _fakedata = function(n_people, max_activities_per_person) {
        var peoples = new Peeps();
        var activities = new Activities();
        var first_names = ["Seb", "Max", "Huw", "Dan", "Bob", "Daya", "Wendy"];
        var last_names = ["Glaser", "Boo", "Bar", "Baz", "Foo", "Quux", "Now", "Shadbolt", "Hall", "Berners-Lee"];
        var actions = ["#tweet", "#hangout", "#meet"];
        var FakeDataMaker =  { 
            makeRandomTimelineStartEnd: function(from, people, start, max_n) {
                var this_ = this;
                if (max_n === undefined) { max_n = 1000; };
                var N = Math.floor(10 + Math.random()*max_activities_per_person);
                // debug(N, "start ", start);
                return util.intRange(0,N).map(function(n) {
                                                  return this_.makeActivity(
                                                      from,
                                                      util.randomlyPick(people),
                                                      start + 24*60*60*1000*Math.random(),
                                                      2*60*60*1000*Math.random() + 10*60*1000*Math.random, // min minutes
                                                      util.randomlyPick(actions),
                                                      undefined);
                                              });
            },
            makeActivity: function (from, to, when, howlong, type, data) {
                return new Activity({ start: when, end: when+howlong, duration: howlong, from: from, to: to, type: type, data: data });
            },
            makeRandomPerson: function() {
                return new Person({
                                      id: util.guid(),
                                      name: [first_names[Math.floor(first_names.length*Math.random())], last_names[Math.floor(last_names.length*Math.random())]].join(" ")
                                  });
            },
            makelast24Hours:function() {
                var now = new Date().valueOf();
                return this.makeTimelineStartEnd(now - 24*60*60*1000, now);
            }
        };
    util.intRange(0,n_people).map(function() { peoples.add(FakeDataMaker.makeRandomPerson()); });
    var peep_urls = peoples.map(function(x) { return x.url(); });
    peep_urls.map(function(pu) { activities.add(FakeDataMaker.makeRandomTimelineStartEnd(pu,peep_urls, (new Date().valueOf() - 24*60*60*1000))); });
    return {
        fake_people: peoples,
        fake_timeline: Activites,
        FakeDataMaker: FakeDataMaker
    };
};