var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;


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
                client.store.getBox(b).then(function(box) {
                    u.debug("loaded box", b);
                    window.movesBox = box;
                    movesInit();
                });
            }
        }


        window.theclient = client;
        if ($scope.selectedBox) { init($scope.selectedBox); }
        $scope.$watch('selectedBox', init);
    });


