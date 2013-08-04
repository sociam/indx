var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;



// MOVES code

function moves_access(token){
    // access moves, sync to box, update visuals
    u.debug("moves_access, token: "+token);
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
                alert("Got new token: " + token);
                moves_access(token);
            });
        },
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
                alert("Got token from previous time: " + status_obj.get("token")[0]);
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


