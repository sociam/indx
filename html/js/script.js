/*
    This file is part of WebBox.

    Copyright 2012 Daniel Alexander Smith
    Copyright 2012 University of Southampton

    WebBox is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    WebBox is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.
*/

/* Author: Daniel A. Smith

*/

$(document).ready(function(){

    $("#login_form").submit(function(){
        var username = $("#login_username").val();
        var password = $("#login_password").val();

        console.debug("Calling login.");
        $.ajax({
            url: "/auth/login",
            data: {"username": username, "password": password},
            type: "POST",
            success: function(data){
                console.debug("Logged in.");
            }
        });
        return false;
    });
    

    /* for: setup_webbox */
    function validURIPath(path){
        // check if a uri path contains all valid characters
        var pathChars = /^([!#$&-:;=?-\[\]\*\+,.@'\(\)_a-zA-Z0-9~]|%[0-9a-fA-F]{2})+$/;
        var match = path.match(pathChars);
        return match != null;
    }
    function getErrorText(input){
        // get or create an error explanation text box (using Foundation style)
        var errorTxt = input.parent().children("small.error");
        if (errorTxt.length == 0){
            errorTxt = $("<small class='error'></small>");
            errorTxt.insertAfter(input);
            return errorTxt;
        } else {
            return $(errorTxt);
        }
    }
    function checkError(input, error, condition){
        // if the error condition is met, then make the input red and show an error text box under it
        var errTxt = getErrorText(input);
        if (condition){
            // error
            input.addClass("error");
            errTxt.html(error);
            errTxt.show();
        } else {
            // no error
            input.removeClass("error");
            errTxt.hide();
        }
        return condition;
    }
    $("#form_setup").submit(function(){
        // validate the webbox setup form input and set up
        var name_input = $("#input_name");
        var uri_input = $("#input_uri");

        var error = false;
        if (checkError(name_input, "Name cannot be blank.", name_input.val() == "")){ error = true; }
        if (checkError(uri_input, "Contains invalid characters.", !validURIPath(uri_input.val()))){ error = true; }

        if (!error){
            // submit setup information via ajax
            var uri = window.webbox_vars.server_url + "/" + uri_input.val();
            var rdf =   "<"+uri+"> <http://webbox.ecs.soton.ac.uk/ns#address> <"+window.webbox_vars.server_url+"> .\n"+
                        "<"+uri+"> <http://xmlns.com/foaf/0.1/name> \""+addslashes(name_input.val())+"\" .\n"+
                        "<"+uri+"> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://xmlns.com/foaf/0.1/Person> . \n"+
                        "<"+uri+"> <http://www.w3.org/2000/01/rdf-schema#label> \""+addslashes(name_input.val())+"\" .\n";

            $.ajax({
                "url": uri,
                "type": "POST",
                "headers": {"Content-type": "text/plain"},
                "data": rdf,
                "success": function(data, textStatus, jqXHR){
                    window.location.reload(true);
                },
                "error": function(jqXHR, textStatus, errorThrown){
                    // TODO handle errors better than this
                    throwModal("Error", "There was an error setting up the WebBox.");
                },
            });
        }
        return false;
    });

    /* for: general purpose */

    // escape quotes
    function addslashes( str ) {
        return (str+'').replace(/([\\"'])/g, "\\$1").replace(/\0/g, "\\0");
    }

    // throw a model error using Reveal (from Foundation)
    function throwModal(errHead, errTxt){
        var modal = $('<div id="errorModal" class="reveal-modal">'+
                        '<h2>'+errHead+'</h2>'+
                        '<p class="lead">'+errTxt+'</p>'+
                        '<a class="close-reveal-modal">&#215;</a>'+
                        '</div>');
        $("body").append(modal);
        modal.reveal({
            animation: "fadeAndPop",
            animationspeed: 300,
            closeOnBackgroundClick: true,
            dismissModelClass: 'close-reveal-modal',
        });
    }

    // simple generic expanding panel, using CSS triangles */
    $(".flyoutsrc").live("mousedown", function(evt){
        // disable selection while clicking
        document.onselectstart = function(){ return false; }
    });
    $(document).live("mouseup", function(evt){
        // re-enable selection after clicking
        document.onselectstart = function(){ return true; }
    });
    $(".flyoutsrc").live("click", function(evt){
        var src = $(evt.target);
        var target = $("#"+src.attr("for"));
        if (target.is(":visible")){
            src.removeClass("flyoutsrc-out");
            src.addClass("flyoutsrc-in");
            target.slideUp();
        } else {
            src.removeClass("flyoutsrc-in");
            src.addClass("flyoutsrc-out");
            target.slideDown();
        }
    });
});
