$(document).ready(function(){
    var vars = $.deparam.fragment();
    if ("code" in vars){
        // step one complete - we have been called back by the authorisation
        $("#step-btn").hide();
        $("#step-text").html("Authorisation successful, now requesting access, wait a moment.");
        $("#step-load").show();
        $.ajax({
            url: "api",
            data: {"code": vars.code, "redirect_url": vars.redirect_url},
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
    } else {
        // initial step, send the user to get authorisation
        var url = $("#start-moves").attr("href");
        url += "#indx=" + escape(window.location);
        $("#start-moves").attr("href", url);
    }
});
