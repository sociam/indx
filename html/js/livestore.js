
function LiveStore(jdiv, freq, path){
    this.jdiv = jdiv;
    this.update_freq = freq;
    this.path = path;
    this.running = false; // are we in the middle of an update?

    this.update();
}

LiveStore.prototype = {

    update: function(){
        var this_ = this;

        /* update every this.update_freq */
        timeoutFunc = function(){
        
            if (!this_.running){
                this_.running = true;

                $.ajax({
                    url: this_.path,
                    data: {"query": "SELECT DISTINCT ?graph WHERE { GRAPH ?graph { ?s ?p ?o } }"},
                    dataType: "xml",
                    success: function(data, textStatus, jqXHR){
                        var xml = $(data);

                        var graphs_div = this_.jdiv.find(".live_graphs");

                        var html = "";

                        xml.find("result").each(function(){
                            var graph_uri = $(this).find("uri").text();
                            html += "<div><tt>"+graph_uri+"</tt></div>";
                        });

                        if (graphs_div.html() != html){
                            graphs_div.html(html);
                            console.debug("updating graphs");
                        }

                        $.ajax({
                            url: this_.path,
                            data: {"query": "SELECT DISTINCT ?s ?p ?o WHERE { ?s ?p ?o }"},
                            dataType: "xml",
                            success: function(data, textStatus, jqXHR){
                                var xml = $(data);

                                var count = 0;

                                xml.find("result").each(function(){
                                    count++;
                                });

                                var html = "<div>"+count+" unique triples in store.</div>";

                                if (html != this_.jdiv.find(".live_triples").html()){
                                    console.debug("updating triple count");
                                    this_.jdiv.find(".live_triples").html(html);
                                }


                                this_.running = false; // we've finished
                            },
                            error: function(err){
                                console.debug("error: ", err);

                                this_.running = false;
                            },
                        });

                    },
                    error: function(err){
                        console.debug("error: ", err);

                        this_.running = false;
                    },
                });
            }

            setTimeout(timeoutFunc, this_.update_freq);
        };
        
        timeoutFunc();
    },
}



