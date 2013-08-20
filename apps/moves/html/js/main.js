var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;


// Generic Objects to INDX box objects walker code
// puts objects into the box and returns the object specified
function objs_to_objs(id, prefix, obj, box){
    // id is the is of the outer object
    // prefix is the prefix for all of the inner objects
    // obj is the actual JS object structure
    // box is used to generate the new Objs

    // TODO optimise this so that it doesn't save a version per value!

    box.get_obj(id).then(function(newobj){
        $.each(obj, function(key, subobj){
            if (subobj instanceof Object){
                var sub_id = prefix + "-" + u.uuid();
                box.get_obj(sub_id).then(function(sub_obj_inbox){
                    newobj.set(key, sub_obj_inbox); // put new subobject as the value of this property
                    newobj.save();
                    objs_to_objs(sub_id, prefix, subobj, box); // then recurse to deal with its properties
                });
            } else if (subobj instanceof Array){
                newobj.set(key, []);
                newobj.save();
                $.each(subobj, function(){
                    var subobj_i = this;
                    if (subobj_i instanceof Object){
                        var sub_id = prefix + "-" + u.uuid();
                        box.get_obj(sub_id_i).then(function(sub_obj_inbox){
                            newobj.set(key, newobj.get(key).push(sub_obj_inbox)); // push new subobject into the array value of this property
                            newobj.save();
                            objs_to_objs(sub_id, prefix, subobj_i, box); // then recurse to deal with its properties
                        });
                    } else {
                        newobj.set(key, newobj.get(key).push(subobj_i));
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

function movesdate_to_date(date){
    date = date[0]+date[1]+date[2]+date[3]+"/"+date[4]+date[5]+"/"+date[6]+date[7];
    return new Date(date);
}

function date_to_movesdate(date){
    // convert a javascript date object into a date in moves api format (YYYYMMDD)
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    return '' + y + '' + (m<=9 ? '0' + m : m) + '' + (d <= 9 ? '0' + d : d);
}

function moves_access(token){
    // access moves, sync to box, update visuals
    u.debug("moves_access, token: "+token);
    $("#step-btn").hide();
    $("#step-load").show();
    $("#step-text").html("Downloading data from moves...");
    moves_box.get_obj("movesdata-status").then(function(status_obj){
        if (status_obj.get("last_date") == undefined){
            // no last date in INDX, so we need to start from the beginning
            moves_api_lookup(token, "/user/profile?").then(function(profile){
                first_date = profile['profile']['firstDate'];
                moves_get_from(token, movesdate_to_date(first_date));
            });
        } else {
            last_date = status_obj.get("last_date")[0];
            from_date = movesdate_to_date(last_date);
            from_date.setDate(from_date.getDate() + 1); // start from the next day
            moves_get_from(token, from_date);
        }
    });
}

function moves_get_from(token, nextdate){
    // get data from this date (js date object) inclusive, onwards up to yesterday
    u.debug("moves_get_from, nextdate: " + nextdate);
    var today = new Date();
    today.setHours(0); today.setMinutes(0); today.setSeconds(0); // midnight

    u.debug("moves_get_from, " + nextdate.getTime() + " < " +today.getTime());
    while (nextdate.getTime() < today.getTime()){
        var thisdate = date_to_movesdate(nextdate);
        moves_api_lookup(token, "/user/storyline/daily/"+thisdate+"?trackPoints=true&").then(function(storyline){
            $("#step-text").html("Downloading data from moves for "+thisdate+"...");
            // add to box
            $.each(storyline, function(){
                var story = this;
                // TODO step through the story and add to the box.
                console.debug("story ", story);
                objs_to_objs("moves-story-"+thisdate,"moves-story-"+thisdate,story,moves_box);
            });

            // add lastdate to box
            moves_box.get_obj("movesdata-status").then(function(status_obj){
                status_obj.set("last_date", thisdate);
                status_obj.save();
            });
        });
        nextdate.setDate(nextdate.getDate() + 1); // set the next day to check
    }
    $("#step-text").html("Moves data updated into INDX successfully.");
    $("#step-load").hide();
}

function moves_api_lookup(token, suburl) {
    // ask for a suburl for a token, it will remade as follows, and proxied through the INDX server:
    // "https://api.moves-app.com/api/v1" + suburl + "access_token=" + token
    // this function returns a promise
    u.debug("moves_api_lookup suburl: " + suburl);
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

function moves_get_token(code){
    u.debug("moves_get_token, code: " + code);

    $("#step-load").show();
    $.ajax({
        url: "api",
        data: {"code": code},
        type: "GET",
        dataType: "json",
        success: function(data, status, xhr){
            var token = data.response.access_token;
            var user_id = data.response.user_id;
            var refresh_token = data.response.refresh_token;
            $("#step-load").hide();
            moves_box.get_obj("movesdata-status").then(function(status_obj){
                status_obj.set("token", token);
                status_obj.set("refresh_token", refresh_token);
                status_obj.set("user_id", user_id);
                status_obj.save();
                moves_access(token);
            });
        }
    });
}

function moves_init(){
    u.debug("moves_init");
    // called when a box is selected by a user
    // start the process of getting the data
    
    // get the 'movesdata-status' object
    if ("moves_box" in window){
        u.debug("moves_init, moves_box present:",moves_box);
        moves_box.get_obj("movesdata-status").then(function(status_obj){
            u.debug("got movesdata-status object",status_obj);
            if (status_obj.get("token") == undefined){
                u.debug("moves access token not present");
                var vars = $.deparam.fragment(); // get the data from the server
                window.location.replace("#"); // remove the data so that we dont accidentally re-trigger this code
                if ("code" in vars){
                    u.debug("moves - Authorised - getting token now.");
                    // step one complete - we have been called back by the authorisation
                    $("#step-btn").hide();
                    $("#step-text").html("Authorisation successful, now requesting access, wait a moment.");

                    moves_get_token(vars['code']);
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
                moves_access(status_obj.get("token")[0]);
            }
        });
    } else {
        // the user will login in a bit.
        // ng-show handles showing the right pane, and then moves_init will be called again
    }
}


// INDX code
angular
    .module('indx')
    .controller('coreDebug', function($scope, client, utils) {
        u.debug("coreDebug controller");
        var init = function(b) {
            u.debug("init, b:"+b+":");
            if (b != undefined){
                window.client = client;
                u.debug("ready to get box", b);
                u.debug("login done, looking up box");
                u.debug("getting box", b);
                client.store.get_box(b).then(function(box) {
                    u.debug("loaded box", b);
                    window.moves_box = box;
                    moves_init();
                });
            }
        }


        window.theclient = client;
        if ($scope.selected_box) { init($scope.selected_box); }
        $scope.$watch('selected_box', init);
    });


