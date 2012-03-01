/* Author: Daniel A. Smith

*/

$(document).ready(function(){

    function longToShort(txt){
        txt = txt.replace(/ /g, "");
        txt = txt.toLowerCase();
        return txt;
    };

    $("#vault_name").keyup(function(){
        $("#vault_shortname").val(longToShort($("#vault_name").val()));
    });

    $("#button_gen_cert").click(function(){
//        console.debug("clicked");
        $("#button_gen_cert").attr("disabled", "disabled");

        $.ajax({
            "data": {"name": $("#input-name").val(), "webid": $("#input-webid").val()},
            "url": "/certificates/",
            "success": function(data){
                // keys are "certificate", "certificate_text", "private_key", "public_key" and "public_key_modulus"
                // exponent is always 65537
                var div = $("#out_cert");
                div.append($("<pre>"+data.certificate_text+"</pre>"));
                
            },
            "dataType": "json",
            // TODO error handling
        });

        // http://localhost.dancak.es:8211/certificates/?name=Daniel+Smith&webid=http://example.com/webid
    });

    $("#button_genhash").click(function(){
        var password = $("#input_password").val();
        var hash = hex_sha256(password);
        $("#input_passhash").val(hash);
        $("#input_password").val("");
        $("#input_password").prop("disabled",true);
        $("#input_passhash").prop("disabled",true);

        $("#button_genhash").prop("disabled",true);
        $("#button_genhash").css("cursor","default");
        $("#button_genhash").hide();

        var div = $("<div class='loading'><img src='../img/loading.gif' alt='Loading...' /></div>");
        div.insertAfter($("#button_genhash"));

        $.ajax({
            url: "../sethash",
            data: {"hash": hash, "vault_shortname": window.vault.shortname},
            success: function(){
                var box = $("#set_encryption_box");
                box.removeClass("error_box").addClass("good_box");
                box.html("<p>Encryption key for this vault has been successfully set.</p>"); 
            },
            // TODO error handling
        });

    });

});





