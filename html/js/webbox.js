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


var wb_json_normalise = function(data){
    var newdata = {};

//    console.debug("data", data);

    var item_map = function(item){
        var newitem = {};
        if ("@id" in item){
            $.each(item, function(key, val){
                if (key == "@type"){
                    newitem["rdf:type"] = val;
                } else if (key == "@id"){
                    // do nothing
                } else {
                    if (typeof val == "string"){
                        newitem[key] = val;
                    } else {
                        newitem[key] = val["@value"];
                    }
                }
            });
        }
        return newitem;
    };

    if ("@graph" in data){
        $.each(data["@graph"], function(){
            var item = this;
            var newitem = item_map(item);
            var id = item["@id"];
            newitem["uri"] = id;
            newdata[id] = newitem;
        });
    } else {
        var item = data;

        if ("@context" in item){
            delete item["@context"];
        }

        var newitem = item_map(item);
        var id = item["@id"];
        newitem["uri"] = id;
        newdata[id] = newitem;
    }

//    console.debug("newdata", newdata);

    return newdata;
}
