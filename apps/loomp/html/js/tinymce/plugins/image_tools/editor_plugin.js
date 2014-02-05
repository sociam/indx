/**
* Image tools to align, edit alt-text and resize images
* 
* Copyright 2011 V. Kleijnendorst - SWIS BV
* 
* 
*/

(function() {
    // Load plugin specific language pack
    tinymce.PluginManager.requireLangPack('image_tools');
    
    tinymce.create('tinymce.plugins.ImageTools', {
        /**
         * Initializes the plugin, this will be executed after the plugin has been created.
         * This call is done before the editor instance has finished it's initialization so use the onInit event
         * of the editor instance to intercept that event.
         *
         * @param {tinymce.Editor} ed Editor instance that the plugin is initialized in.
         * @param {string} url Absolute URL to where the plugin is located.
         */
        init : function(ed, url) {
            
            var t = this;
            t.ed = ed;
            
            ed.onNodeChange.add(function(ed, cm, n, co) {
                cm.setActive('image_float_left', n.nodeName == 'IMG' && ed.dom.hasClass(n, 'float_left'));
                cm.setActive('image_float_right', n.nodeName == 'IMG' && ed.dom.hasClass(n, 'float_right'));
                cm.setActive('image_float_none', n.nodeName == 'IMG' && !ed.dom.hasClass(n, 'float_left') && !ed.dom.hasClass(n, 'float_right'));
                
                if (n.nodeName == 'IMG'){   
                    cm.setDisabled('image_width_min', ed.dom.getSize(n)['w'] <= 20);
                }
                
            });
            
            ed.addCommand('mceImageFloatLeft', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){
                    // remove any inline styling (float from alignment buttons)
                    el.style.cssText = ''; 
                    tinymce.DOM.addClass(el, 'float_left');
                    tinymce.DOM.removeClass(el, 'float_right');
                    
                }
                ed.execCommand("mceRepaint");

                
                
            });
            ed.addCommand('mceImageFloatRight', function() {

     
                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){ 
                    // remove any inline styling (float from alignment buttons)
                    el.style.cssText = ''; 
                    tinymce.DOM.addClass(el, 'float_right');
                    tinymce.DOM.removeClass(el, 'float_left');
                }
                ed.execCommand("mceRepaint");
                
            });
            
            ed.addCommand('mceImageFloatNone', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){ 
                    // remove any inline styling (float from alignment buttons)
                    el.style.cssText = '';
                    tinymce.DOM.removeClass(el, 'float_left');  
                    tinymce.DOM.removeClass(el, 'float_right');  
                }
                ed.execCommand("mceRepaint");
                
            });
            
            ed.addCommand('mceImageImageSizePlus', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){ 
                    var src = el.src;
                    
                    if (src.indexOf('fltr[]=crop') != -1){
                        // it's a cropped image. Don't resize it
                        return;
                    }
                    
                    var iOldWidth = el.width;
                    
                    el.width = el.width + (el.width / 20);
                    ed.dom.setAttrib(el, 'height', ''); 
                    
                    if (isNaN(el.width)){
                        el.width = iOldWidth;
                    }
                    
                    // set the width and height for phpThumb
                    src = src.replace(/w=([0-9]+)/, function(m){return 'w=' + (el.width)});
                    src = src.replace(/h=([0-9]+)/, function(m){return ''});
                    
                    // wait 500ms to set the source, to make sure we're not resizing at this moment
                    t.setSource(el, src);
                    
                    
                    ed.execCommand("mceRepaint");
                }
 
                
            });
            
            ed.addCommand('mceImageImageSizeMin', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){ 
                    var src = el.src;
                    
                    if (src.indexOf('fltr[]=crop') != -1){
                        return;
                    }
                    
                    
                    var iOldWidth = el.width;
                    
                    el.width = el.width - (el.width / 20);
                    ed.dom.setAttrib(el, 'height', ''); 
                    
                    if (isNaN(el.width) || el.width < 20){
                        el.width = 20; 
                    }
                    
                    // set the width and height for phpThumb
                    src = src.replace(/w=([0-9]+)/, function(m){return 'w=' + (el.width)});
                    src = src.replace(/h=([0-9]+)/, function(m){return ''}); 
                    
                    // wait 500ms to set the source, to make sure we're not resizing at this moment
                    t.setSource(el, src);
                    
                    ed.execCommand("mceRepaint", false);
                }

                
            });
            
            ed.addCommand('mceImageImageSizeOriginal', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'IMG'){ 
                    var src = el.src;
                    
                    if (src.indexOf('&') != -1){
                        
                        var ext = '';
                        if (src.indexOf('.') != -1){
                            ext = src.substr(src.lastIndexOf('.') + 1);
                            if (ext.indexOf('&') != -1){
                                ext = ext.substr(0, ext.indexOf('&'));
                            }
                        }
                        ed.dom.setAttrib(el, 'width', ''); 
                        ed.dom.setAttrib(el, 'height', ''); 
                                                
                        t.setSource(el, src.substr(0, src.indexOf('&')) + '&f=' + ext); 
                        
                    }
                    
                    ed.execCommand("mceRepaint", false);
                }

                
            });
            
            
            //mceImageImageRemove
            ed.addCommand('mceImageRemove', function() {
 
                //console.log('remove image');
                try{
                    var el = ed.selection.getNode(); 
                    if (el.nodeName == 'IMG'){ 
                        ed.execCommand('mceRemoveNode', false, el);
                    }
                    ed.execCommand("mceRepaint", false); 
                } catch(e){}
                
            });
            
            // mceImageAlt
            ed.addCommand('mceImageAlt', function() {
 
                var el = ed.selection.getNode(); 
                if (el.nodeName == 'IMG'){ 
                    // open window
                    ed.windowManager.open({
                        file : url + '/alt.html',
                        width : 320 + parseInt(ed.getLang('media.delta_width', 0)),
                        height : 120 + parseInt(ed.getLang('media.delta_height', 0)),
                        inline : 1
                    }, {
                        plugin_url : url
                    });
                    
                }

                
            });
            
            
            // image_alt 
            ed.addButton('image_alt', {
                title : 'image_tools.alt',
                cmd : 'mceImageAlt',
                'class' : 'big',
                label : 'image_tools.alt_label',
                image : url + '/img/image_alt.png'
                
            }); 
            

            // Register LoremIpsum button
            ed.addButton('image_float_left', {
                title : 'image_tools.float_left',
                cmd : 'mceImageFloatLeft',
                'class' : 'big',  
                label : 'image_tools.float_left_label',
                image : url + '/img/image_left.png'
            });
            ed.addButton('image_float_right', {
                title : 'image_tools.float_right',
                cmd : 'mceImageFloatRight',
                'class' : 'big',  
                label : 'image_tools.float_right_label',
                image : url + '/img/image_right.png'
            });
            ed.addButton('image_float_none', {
                title : 'image_tools.float_none',
                cmd : 'mceImageFloatNone',
                'class' : 'big',  
                label : 'image_tools.float_none_label',
                image : url + '/img/image_none.png'
            });
            
            //image_width_plus
            ed.addButton('image_width_plus', {
                title : 'image_tools.width_plus',
                cmd : 'mceImageImageSizePlus',
                label : 'image_tools.width_plus_label',
                image : url + '/img/image_width_plus.png'
            });
            ed.addButton('image_width_min', {
                title : 'image_tools.width_min',
                cmd : 'mceImageImageSizeMin',
                label : 'image_tools.width_min_label',
                image : url + '/img/image_width_min.png'
            });
            
            ed.addButton('image_width_original', {
                title : 'image_tools.width_original',
                cmd : 'mceImageImageSizeOriginal',
                label : 'image_tools.width_original_label',
                image : url + '/img/image_width_original.png'
            });
            
            //
            
            ed.addButton('image_edit', {
                title : 'image_tools.edit',
                cmd : 'mceImage',
                label : 'image_tools.edit_label',
                image : url + '/img/image_edit.png'
            });
            
            ed.addButton('image_remove', {
                title : 'image_tools.remove',
                cmd : 'mceImageRemove',
                label : 'image_tools.remove_label',
                image : url + '/img/image_delete.png'
            });
            
            

        },
        
        /**
        *   Set the src attribute delayed at 500ms
        */
        setSource : function(el, src){
            
            //console.log(src);
            
            var t = this;
            if (t._setSourceTimer){
                clearTimeout(t._setSourceTimer);
            }    
            t._setSourceTimer = setTimeout(function(){
                t._setSourceTimed(el, src);    
            }, 500);
            
        },
        
        /**
        *   Set the new src
        *   If it matches a PhpThumb uri, it should now reload and sharpen
        */
        _setSourceTimed : function(el, src){
            var t = this;
            t.ed.dom.setAttrib(el, 'src', src); 
            t.ed.dom.setAttrib(el, "mce_src", src);  
            
            t.ed.execCommand("mceRepaint", false); 
            t.ed.nodeChanged();
            
            
        },
        
        
        
        

        /**
         * Creates control instances based in the incomming name. This method is normally not
         * needed since the addButton method of the tinymce.Editor class is a more easy way of adding buttons
         * but you sometimes need to create more complex controls like listboxes, split buttons etc then this
         * method can be used to create those.
         *
         * @param {String} n Name of the control to create.
         * @param {tinymce.ControlManager} cm Control manager to use inorder to create new control.
         * @return {tinymce.ui.Control} New control instance or null if no control was created.
         */
        createControl : function(n, cm) {
            return null;
        },

        /**
         * Returns information about the plugin as a name/value array.
         * The current keys are longname, author, authorurl, infourl and version.
         *
         * @return {Object} Name/value array containing information about the plugin.
         */
        getInfo : function() {
            return {
                longname : 'Image manipulation buttons',
                author : 'V. Kleijnendorst - SWIS BV',
                authorurl : 'http://www.swis.nl',
                infourl : 'http://www.swis.nl',
                version : "0.1"
            };
        }
    });

    // Register plugin
    tinymce.PluginManager.add('image_tools', tinymce.plugins.ImageTools);
})();
