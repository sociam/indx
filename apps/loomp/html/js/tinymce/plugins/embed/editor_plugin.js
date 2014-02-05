/**
 * editor_plugin_src.js
 * 
 */

(function() {
    // Load plugin specific language pack
    tinymce.PluginManager.requireLangPack('embed');
    
    tinymce.create('tinymce.plugins.EmbedPlugin', {
        /**
         * Initializes the plugin, this will be executed after the plugin has been created.
         * This call is done before the editor instance has finished it's initialization so use the onInit event
         * of the editor instance to intercept that event.
         *
         * @param {tinymce.Editor} ed Editor instance that the plugin is initialized in.
         * @param {string} url Absolute URL to where the plugin is located.
         */
        init : function(ed, url) {
            // Register the command so that it can be invoked by using tinyMCE.activeEditor.execCommand('mceExample');
            ed.addCommand('mceEmbed', function() {  
                ed.windowManager.open({
                    file : url + '/dialog.htm',
                    width : 365 + parseInt(ed.getLang('embed.delta_width', 0)),
                    height : 305 + parseInt(ed.getLang('embed.delta_height', 0)),
                    inline : 1
                }, {
                    plugin_url : url // Plugin absolute URL
                });   
            });
            
            
            // load the required CSS file to give embed-code background images (youtube, vimeo, etc)
            ed.onInit.add(function() {  
                ed.dom.loadCSS(url + "/css/content.css");  
            });
            
            ed.onNodeChange.add(function(ed, cm, n, co) {
                cm.setActive('embed_float_left', n.nodeName == 'DIV' && ed.dom.hasClass(n, 'float_left'));
                cm.setActive('embed_float_right', n.nodeName == 'DIV' && ed.dom.hasClass(n, 'float_right'));
                cm.setActive('embed_float_none', n.nodeName == 'DIV' && !ed.dom.hasClass(n, 'float_left') && !ed.dom.hasClass(n, 'float_right'));
                
                if (n && n.nodeName == 'DIV'){
                    cm.setDisabled('embed_resize_min', ed.dom.getSize(n)['w'] <= 250);
                } else if(n.nodeName == 'IFRAME'){
                    cm.setDisabled('embed_resize_min', ed.dom.getSize(n.parentNode)['w'] <= 250);
                }
                
            });
            
            ed.addCommand('mceEmbedFloatLeft', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'DIV'){
                    tinymce.DOM.addClass(el, 'float_left');
                    tinymce.DOM.removeClass(el, 'float_right');
                    
                }
                ed.execCommand("mceRepaint");

                
                
            });
            
            ed.addCommand('mceEmbedFloatRight', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'DIV'){
                    tinymce.DOM.addClass(el, 'float_right');
                    tinymce.DOM.removeClass(el, 'float_left');
                    
                }
                ed.execCommand("mceRepaint");

                
                
            });
            
            ed.addCommand('mceEmbedFloatNone', function() {

                var el = ed.selection.getNode();
                if (el.nodeName == 'DIV'){
                    tinymce.DOM.removeClass(el, 'float_right');
                    tinymce.DOM.removeClass(el, 'float_left');
                    
                }
                ed.execCommand("mceRepaint");

                
                
            });
            
            
            ed.addCommand('mceEmbedResizeMin', function() {

                var el = ed.selection.getNode();
                                
                if (el.nodeName != 'DIV'){
                    if (el = ed.dom.getParent(el)){
                        if(el.nodeName == 'DIV' && ed.dom.hasClass(el, 'media_embed')){
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                var style = ed.dom.getAttrib(el, 'style');
                   
                var w = /width: ?([0-9]+)/.exec(style);
                var h = /height: ?([0-9]+)/.exec(style); 

                if (w[1] && h[1]){
                    var newWidth  = Math.ceil(w[1] * 0.9);
                    var newHeight = Math.ceil(h[1] * 0.9);
                    
                    if (newWidth < 250){
                        newWidth = 250;
                        newHeight = h[1];
                    }
                    ed.dom.setAttrib(el, 'style', 'width: ' + newWidth + 'px; height: ' + newHeight + 'px');
                    var source = el.innerHTML;

                    source = source.replace(/width="([0-9]+)"/g, function(m, width){return 'width="' + Math.ceil(Number(width) * 0.9) + '"'});   
                    source = source.replace(/height="([0-9]+)"/g, function(m, height){return 'height="' + Math.ceil(Number(height) * 0.9) + '"'});   

                    el.innerHTML = source;
                }
            });
            
            
            ed.addCommand('mceEmbedResizePlus', function() {

                var el = ed.selection.getNode();
                                
                if (el.nodeName != 'DIV'){
                    if (el = ed.dom.getParent(el)){
                        if(el.nodeName == 'DIV' && ed.dom.hasClass(el, 'media_embed')){
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                var style = ed.dom.getAttrib(el, 'style');
                   
                var w = /width: ?([0-9]+)/.exec(style);
                var h = /height: ?([0-9]+)/.exec(style); 

                if (w[1] && h[1]){
                    var newWidth  = Math.ceil(w[1] * 1.1);
                    var newHeight = Math.ceil(h[1] * 1.1);
                    
                    if (newWidth < 1024){
                        ed.dom.setAttrib(el, 'style', 'width: ' + newWidth + 'px; height: ' + newHeight + 'px');
                        var source = el.innerHTML;

                        source = source.replace(/width="([0-9]+)"/g, function(m, width){return 'width="' + Math.ceil(Number(width) * 1.1) + '"'});   
                        source = source.replace(/height="([0-9]+)"/g, function(m, height){return 'height="' + Math.ceil(Number(height) * 1.1) + '"'});   

                        el.innerHTML = source;
                    }
                }
            });
            
            
            ed.addCommand('mceEmbedRemove', function() {
 
                //console.log('remove image');
                try{
                    var el = ed.selection.getNode(); 
                    if (el.nodeName == 'DIV'){ 
                        // make this one undo level!
                        ed.undoManager.add();
                        el.innerHTML = '';
                        ed.execCommand('mceRemoveNode', false, el);
                        ed.undoManager.add();
                    }
                    ed.execCommand("mceRepaint", false); 
                } catch(e){}
                
            });
            
            
            
                      
            // Register embed button
            ed.addButton('embed', {
                title : 'embed.desc',
                cmd : 'mceEmbed',
                label : 'embed.label',
                'class': 'big', 
                image : url + '/img/embed.png'
            });  
            
            ed.addButton('embed_edit', {
                title : 'embed.edit',
                cmd : 'mceEmbed',
                label : 'embed.edit',
                image : url + '/img/image_edit.png'
            });   
            
            ed.addButton('embed_resize_min', {
                title : 'embed.shrink',
                cmd : 'mceEmbedResizeMin',
                label : 'embed.shrink', 
                image : url + '/img/image_width_min.png'
            });   
            
            ed.addButton('embed_resize_plus', {
                title : 'embed.grow',
                cmd : 'mceEmbedResizePlus',
                label : 'embed.grow', 
                image : url + '/img/image_width_plus.png'
            }); 
            
            ed.addButton('embed_remove', {
                title : 'embed.remove',
                cmd : 'mceEmbedRemove',
                label : 'embed.remove', 
                image : url + '/img/image_delete.png'
            });
            
            ed.addButton('embed_float_left', {
                title : 'embed.left_desc',
                cmd : 'mceEmbedFloatLeft',
                'class' : 'big',  
                label : 'embed.left', 
                image : url + '/img/image_left.png'
            });
            
            ed.addButton('embed_float_right', {
                title : 'embed.right_desc',
                cmd : 'mceEmbedFloatRight',
                'class' : 'big',  
                label : 'embed.right', 
                image : url + '/img/image_right.png'
            });
            
            ed.addButton('embed_float_none', {
                title : 'embed.none_desc',
                cmd : 'mceEmbedFloatNone',
                'class' : 'big',  
                label : 'embed.none', 
                image : url + '/img/image_none.png'
            });
            
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
                longname : 'Embed plugin',
                author : 'Vincent Kleijnendorst - SWIS BV',
                authorurl : 'http://www.swis.nl',
                infourl : 'http://www.swis.nl',
                version : "1.0"
            };
        }
    });          

    // Register plugin
    tinymce.PluginManager.add('embed', tinymce.plugins.EmbedPlugin);
})();