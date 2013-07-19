/*
    Copyright (C) 2011-2013 University of Southampton
    Copyright (C) 2011-2013 Daniel Alexander Smith
    Copyright (C) 2011-2013 Max Van Klek
    Copyright (C) 2011-2013 Nigel R. Shadbolt

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License, version 3,
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


/* creates a new browserone without using new. which is all the rage (?) */
function browseOne(uri, sparql, surface){
    var b = new browserOne(uri, sparql, surface);
}

/* or you can just create a "new" one of these, whatever. */
var browserOne = function(uri, sparql, surface){
    this.surface = surface;
    this.surface.addClass(".bo_surface");
    this.sparql = sparql;
    this.uri = uri;
    this.setup();

    // make bo_items clickable
    this.surface.on("click", ".bo_item", function(evt){
        var target = $(evt.target);
        var thisUri = target.html();

        browseOne(thisUri, sparql, surface);
    });
};

browserOne.prototype = {
    setup: function(){
        var bo = this;
        bo.surface.html("");

        bo.title = $("<h3>Browsing: <tt>"+bo.uri+"</tt></h3>");
        bo.surface.append(bo.title);

        bo.panel = $("<div class='panel'></div>");
        bo.surface.append(bo.panel);

        var query = "CONSTRUCT {<"+bo.uri+"> ?p ?o} WHERE {<"+bo.uri+"> ?p ?o}"

        $.ajax({
            url: bo.sparql,
            type: "GET",
            headers: {"Accept": "text/json"},
            data: {"query": query},
            success: function (data){
                var options = {
                    base: "",
                    strict: false,
                    optimize: true,
                    graph: false
                };
                jsonld.expand(data, options, function(err, expanded){
                    var expanded2 = expanded[0]; // we only passed in one
                    $.each(expanded2, function(key, value){
                        var row = "<div class='bo_row'><div class='bo_key'><span class='bold'>"+key+"</span></div>";
                        if (typeof value == "string"){
                            row += "<div class='bo_val'>"+value+"</div>";
                        } else {
                            $.each(value, function(){
                                var val = this;
                                if (typeof val == "string"){
                                    row += "<div class='bo_val'>"+val+"</div>";
                                } else {
                                    if (val.toString() == "[object Object]"){
                                        if ("@value" in val){
                                            row += "<div class='bo_val'>"+val["@value"]+"</div>";
                                        } else {
                                            row += "<div class='bo_val bo_item'>"+val["@id"]+"</div>";
                                        }
                                    } else {
                                        row += "<div class='bo_val bo_item'>"+val.toString()+"</div>";
                                    }
                                }
                            });
                        }
                        row += "</div>";
                        row = $(row);
                        bo.panel.append(row);
                    });
                });
            },
        });
    }
};

