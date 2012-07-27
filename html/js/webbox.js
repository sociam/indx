

var wb_json_normalise = function(data){
    var newdata = {};

    console.debug("data", data);


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

    console.debug("newdata", newdata);

    return newdata;
}
