var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;



// MOVES code

function moves_get_token(code, redirect_url){
    u.debug("moves_get_token");

    $("#step-load").show();
    $.ajax({
        url: "api",
        data: {"code": code, "redirect_url": redirect_url},
        type: "GET",
        dataType: "json",
        success: function(data, status, xhr){
            var token = data.response.access_token;
            var user_id = data.response.user_id;
            var refresh_token = data.response.refresh_token;
            alert(token);
            $("#step-load").hide();
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
            if (status_obj.get("code") == undefined){
                u.debug("moves status code not present");
                var vars = $.deparam.fragment();
                if ("code" in vars){
                    u.debug("moves - Authorised - getting token now.");
                    // step one complete - we have been called back by the authorisation
                    $("#step-btn").hide();
                    $("#step-text").html("Authorisation successful, now requesting access, wait a moment.");

                    moves_set_code(vars['code'], vars['redirect_url']);
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
                moves_get_token(status_obj.get("code")[0], status_obj.get("redirect_url")[0]);
            }
        });
    } else {
        // the user will login in a bit.
        // ng-show handles showing the right pane, and then moves_init will be called again
    }
}

function moves_set_code(code, redirect_url){
    u.debug("moves_set_code");
    // called when we get the access code for the first time
    // we save it in the box and then get a token for this session
    moves_box.get_obj("movesdata-status").then(function(status_obj){
        status_obj.set("code", code);
        status_obj.set("redirect_url", redirect_url);
        status_obj.save();
        moves_get_token(code, redirect_url);
    });
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


