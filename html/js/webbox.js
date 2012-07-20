
var wb_json_normalise = function(data){
    var newdata = {};

    $.each(data["@graph"], function(){
        var item = this;
        var newitem = {};
        if ("@id" in item){
            $.each(item, function(key, val){
                if (key == "@type"){
                    newitem["rdf:type"] = val;
                } else if (key == "@id"){
                    // do nothing
                } else {
                    newitem[key] = val["@value"];
                }
            });
            var id = item["@id"];
            newitem["uri"] = id;
            newdata[id] = newitem;
        }
    });

    return newdata;
}
