/**
 * editor_plugin_src.js
 * 
 */

(function() {
    // Load plugin specific language pack
    tinymce.PluginManager.requireLangPack('bestandsbeheer');
    
    tinymce.create('tinymce.plugins.BestandsbeheerPlugin', {

        init : function(ed, url) {
                  
            var t = this;
            t.ed = ed;                        
                     
            // Ribbon namespace
            if (!ed.oRibbon){ed.oRibbon = {}}   
            
            
            // image namespace
            if (!ed.oRibbon.oImage){
                ed.oRibbon.oImage = {};
                ed.oRibbon.oImage.ed = ed; 
                
                /**
                *   Insert image 
                */
                ed.oRibbon.oImage.insertRawImage = function(path, alt){    
                    
                    var t = this;

                    t.insertHtml('<img src="' + path + '" alt="' + alt + '">');
                    
                };
                
            }
            
            
            ed.addCommand('mceImage', function(){
                

                  ed.windowManager.open({
                        file : url,
                        width : 940,
                        height : 455,
                        style : 'margin-left:-10px',
                        inline : 1
                    }, {
                        plugin_url : url
                    });
            });
            
            
            ed.addCommand('mceBestandsbeheerVideo', function(){  
                
                ed.windowManager.open({
                        file : url,
                        width : 940,
                        height : 455,
                        inline : 1
                    }, {
                        plugin_url : url
                    });    
            });
            
            ed.addCommand('mceBestandsbeheerMp3', function(){  

                ed.windowManager.open({
                        file : url,
                        width : 940,
                        height : 455,
                        inline : 1
                    }, {
                        plugin_url : url
                    });    
            });
                        
            ed.addCommand('mceBestandsbeheerFile', function(){  
               
                ed.windowManager.open({
                        file : url,
                        width : 940,
                        height : 455,
                        inline : 1
                    }, {
                        plugin_url : url
                    });    
            });
            
            
            ed.addButton('bestandsbeheer_video', {
                title : 'bestandsbeheer.video',
                cmd : 'mceBestandsbeheerVideo',
                'class' : 'big', 
                label : 'bestandsbeheer.video', 
                image : url + '/img/video.png'
            });
            
            ed.addButton('bestandsbeheer_mp3', {
                title : 'bestandsbeheer.mp3',
                cmd : 'mceBestandsbeheerMp3',
                'class' : 'big', 
                label : 'bestandsbeheer.mp3', 
                image : url + '/img/mp3.png'
            });
            
            ed.addButton('bestandsbeheer_file', {
                title : 'bestandsbeheer.file',
                cmd : 'mceBestandsbeheerFile',
                'class' : 'big', 
                label : 'bestandsbeheer.file', 
                image : url + '/img/file.png'
            });
            
             
        },
          


        /**
         * Returns information about the plugin as a name/value array.
         * The current keys are longname, author, authorurl, infourl and version.
         *
         * @return {Object} Name/value array containing information about the plugin.
         */
        getInfo : function() {
            return {
                longname : 'Bestandsbeheer plugin',
                author : 'Vincent Kleijnendorst - SWIS BV',
                authorurl : 'http://www.swis.nl',
                infourl : 'http://www.swis.nl',
                version : "1.0"
            };
        }
    });          

    // Register plugin
    tinymce.PluginManager.add('bestandsbeheer', tinymce.plugins.BestandsbeheerPlugin);
})();