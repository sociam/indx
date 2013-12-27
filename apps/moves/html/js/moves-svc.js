
    
// test
var nodeindx = require('../../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore')
    jQuery = require('jquery'),
    path = require('path'),
    simpleweather = require('./jquery.simpleWeather').load(jQuery),
    nodeservice = require('../../lib/services/nodejs/service');

var MovesService = Object.create(nodeservice.NodeService, {
    run: { 
        value: function(store) {
            // run continuously
            var this_ = this, config = this.load_config();
        }
    },
    get_moves: { // ecmascript 5, don't be confused!
        value: function(store) {
            var this_ = this;
            this.load_config().then(function(config) {
                // this_.debug('config! ', config, typeof config, JSON.parse(config));
                config = JSON.parse(config);
                if (!config || !_(config).keys()) {  this_.debug(' no configuration set, aborting ');  return;  }
                var boxid = config.box;
                store.getBox(boxid).then(function(box) {
                    var sleep = config.sleep, loc = config.latlngs;
                    this_.debug('configured for ', loc, ' sleeping ', sleep, 'msec ');
                    var sleepmsec = parseInt(sleep,10), locs = loc.split(' ').map(function(x) { return x.split(','); });
                    var lat = locs[0][0], lon = locs[0][1];
                    jQuery.get('http://api.openweathermap.org/data/2.5/weather?' + jQuery.param({lat:lat,lon:lon,units:'metric', format:'json'}))
                        .then(function(json) { 
                            this_.debug('Fetched and unpacked weather >> - id:', json.id, ' - dt ', json.dt);
                            var weatherid = 'weather-report-'+json.id+'-'+json.dt;
                            u.when([
                                this_._unpack(json,box),
                                box.getObj(weatherid)
                            ]).then(function(wobj) {
                                var unpacked = wobj[0], weather = wobj[1];
                                weather.set(unpacked);
                                weather.save().then(function() {
                                    this_.debug('successfully saved weather ', weatherid);
                                }).fail(function(err) { console.error('error saving weather', err); });
                            }); 
                        }).fail(function(err) { console.log(err);  });
                }).fail(function(err) { this_.debug('error getting box ', err); }); 
            }).fail(function(err) { console.error('error loading config', err); });
        }
    },
    _unpack: {
        value: function(c, box) {
            var w = {}, d = u.deferred();            
            // var locationid = 'weather-condition-'+c.weather[0].id;
            //     box.getObj(weatherconditionid).then(function(wcobj) {
            //         wcobj.set(c.weather[0]);
            //         wcobj.save();
            //         d.resolve(w);
            //     }).fail(d.reject);
            // }
            return d.promise();
        }
    }
});

if (require.main === module) { 
    var ws = Object.create(WeatherService);
    ws.init(path.dirname(module.filename));
}


// Generic Objects to INDX box objects walker code
// puts objects into the box and returns the object specified
function objsToObjs(id, prefix, obj, box){
    // id is the is of the outer object
    // prefix is the prefix for all of the inner objects
    // obj is the actual JS object structure
    // box is used to generate the new Objs

    // TODO optimise this so that it doesn't save a version per value!

    box.getObj(id).then(function(newobj){
        $.each(obj, function(key, subobj){
            if (subobj instanceof Object){
                var subId = prefix + "-" + u.uuid();
                box.getObj(subId).then(function(subObjInbox){
                    newobj.set(key, subObjInbox); // put new subobject as the value of this property
                    newobj.save();
                    objsToObjs(subId, prefix, subobj, box); // then recurse to deal with its properties
                });
            } else if (subobj instanceof Array){
                newobj.set(key, []);
                newobj.save();
                $.each(subobj, function(){
                    var subobjI = this;
                    if (subobjI instanceof Object){
                        var subId = prefix + "-" + u.uuid();
                        box.getObj(subIdI).then(function(subObjInbox){
                            newobj.set(key, newobj.get(key).push(subObjInbox)); // push new subobject into the array value of this property
                            newobj.save();
                            objsToObjs(subId, prefix, subobjI, box); // then recurse to deal with its properties
                        });
                    } else {
                        newobj.set(key, newobj.get(key).push(subobjI));
                        newobj.save();
                    }
                });
            } else {
                // primitive
                newobj.set(key, subobj);
                newobj.save();
            }
        });
    });
}




// MOVES code

function movesdateToDate(date){
    date = date[0]+date[1]+date[2]+date[3]+"/"+date[4]+date[5]+"/"+date[6]+date[7];
    return new Date(date);
}

function dateToMovesdate(date){
    // convert a javascript date object into a date in moves api format (YYYYMMDD)
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    return '' + y + '' + (m<=9 ? '0' + m : m) + '' + (d <= 9 ? '0' + d : d);
}

function movesAccess(token){
    // access moves, sync to box, update visuals
    u.debug("movesAccess, token: "+token);
    $("#step-btn").hide();
    $("#step-load").show();
    $("#step-text").html("Downloading data from moves...");
    movesBox.getObj("movesdata-status").then(function(statusObj){
        if (statusObj.get("lastDate") == undefined){
            // no last date in INDX, so we need to start from the beginning
            movesApiLookup(token, "/user/profile?").then(function(profile){
                firstDate = profile['profile']['firstDate'];
                movesGetFrom(token, movesdateToDate(firstDate));
            });
        } else {
            lastDate = statusObj.get("lastDate")[0];
            fromDate = movesdateToDate(lastDate);
            fromDate.setDate(fromDate.getDate() + 1); // start from the next day
            movesGetFrom(token, fromDate);
        }
    });
}

function movesGetFrom(token, nextdate){
    // get data from this date (js date object) inclusive, onwards up to yesterday
    u.debug("movesGetFrom, nextdate: " + nextdate);
    var today = new Date();
    today.setHours(0); today.setMinutes(0); today.setSeconds(0); // midnight

    u.debug("movesGetFrom, " + nextdate.getTime() + " < " +today.getTime());
    while (nextdate.getTime() < today.getTime()){
        var thisdate = dateToMovesdate(nextdate);
        movesApiLookup(token, "/user/storyline/daily/"+thisdate+"?trackPoints=true&").then(function(storyline){
            $("#step-text").html("Downloading data from moves for "+thisdate+"...");
            // add to box
            $.each(storyline, function(){
                var story = this;
                // TODO step through the story and add to the box.
                console.debug("story ", story);
                objsToObjs("moves-story-"+thisdate,"moves-story-"+thisdate,story,movesBox);
            });

            // add lastdate to box
            movesBox.getObj("movesdata-status").then(function(statusObj){
                statusObj.set("lastDate", thisdate);
                statusObj.save();
            });
        });
        nextdate.setDate(nextdate.getDate() + 1); // set the next day to check
    }
    $("#step-text").html("Moves data updated into INDX successfully.");
    $("#step-load").hide();
}

function movesApiLookup(token, suburl) {
    // ask for a suburl for a token, it will remade as follows, and proxied through the INDX server:
    // "https://api.moves-app.com/api/v1" + suburl + "accessToken=" + token
    // this function returns a promise
    u.debug("movesApiLookup suburl: " + suburl);
    var d = u.deferred();
    $.ajax({
        url: "api",
        data: {"token": token, "suburl": suburl},
        type: "GET",
        dataType: "json",
        success: function(data, status, xhr){
            d.resolve(data.response); // send response back
        }
    });
    return d.promise();
}

function movesGetToken(code){
    u.debug("movesGetToken, code: " + code);

    $("#step-load").show();
    $.ajax({
        url: "api",
        data: {"code": code},
        type: "GET",
        dataType: "json",
        success: function(data, status, xhr){
            var token = data.response.accessToken;
            var userId = data.response.userId;
            var refreshToken = data.response.refreshToken;
            $("#step-load").hide();
            movesBox.getObj("movesdata-status").then(function(statusObj){
                statusObj.set("token", token);
                statusObj.set("refreshToken", refreshToken);
                statusObj.set("userId", userId);
                statusObj.save();
                movesAccess(token);
            });
        }
    });
}

function movesInit(){
    u.debug("movesInit");
    // called when a box is selected by a user
    // start the process of getting the data
    
    // get the 'movesdata-status' object
    if ("movesBox" in window){
        u.debug("movesInit, movesBox present:",movesBox);
        movesBox.getObj("movesdata-status").then(function(statusObj){
            u.debug("got movesdata-status object",statusObj);
            if (statusObj.get("token") == undefined){
                u.debug("moves access token not present");
                var vars = $.deparam.fragment(); // get the data from the server
                window.location.replace("#"); // remove the data so that we dont accidentally re-trigger this code
                if ("code" in vars){
                    u.debug("moves - Authorised - getting token now.");
                    // step one complete - we have been called back by the authorisation
                    $("#step-btn").hide();
                    $("#step-text").html("Authorisation successful, now requesting access, wait a moment.");

                    movesGetToken(vars['code']);
                } else {
                    $("#step-div").show(); // make sure the initial step div is shown

                    u.debug("moves - not authorized, giving user link to do that");
                    // initial step, send the user to get authorisation
                    var url = $("#start-moves").attr("href");
                    url += "#indx=" + escape(window.location);
                    $("#start-moves").attr("href", url);
                }

            } else {
                u.debug("moved status code present.");
                // we have an access code already, so no need to re-auth
                // now we get the token
                movesAccess(statusObj.get("token")[0]);
            }
        });
    } else {
        // the user will login in a bit.
        // ng-show handles showing the right pane, and then movesInit will be called again
    }
}


