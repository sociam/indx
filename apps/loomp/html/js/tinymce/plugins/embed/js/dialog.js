tinyMCEPopup.requireLangPack();

var EmbedDialog = {
	init : function() {
		var f = document.forms[0], div, sContent, sInnerHTML;
        var ed = tinyMCEPopup.editor;  

		// Get the selected contents as text and place it in the input
        sContent = '';
        if (ed.selection.getContent() != ''){
            sInnerHTML = ed.selection.getNode().innerHTML; 
		    if (sInnerHTML.indexOf('<') > 0){
                sContent = sInnerHTML;
            }
        } 
        if(ed.selection.getNode().nodeName == 'DIV' && ed.dom.hasClass(ed.selection.getNode(), 'media_embed')){
            sContent = ed.selection.getNode().innerHTML;
            
        }
        
        var oDiv = document.createElement('div');
        oDiv.innerHTML = sContent;
        
        var aDiv = oDiv.getElementsByTagName('div');
        if (aDiv.length == 1){
            sContent = aDiv[0].innerHTML;
        }
               
        f.embedcode.value = sContent;
	},

	insert : function() {
		// Insert the contents from the input into the document
        
        var sEmbedCode = document.forms[0].embedcode.value;
        if (sEmbedCode == ''){
            // niets ingevuld
            document.getElementById('error').innerHTML = tinyMCEPopup.getLang('embed_dlg.error_empty'); //'Plak hier de embed code.';
            return;
        }
        if (sEmbedCode.indexOf('<') == -1){
            // niets ingevuld
            document.getElementById('error').innerHTML = tinyMCEPopup.getLang('embed_dlg.error_valid'); // 'Dit is geen geldige embedcode.';
            return;
        }
        
        
        // get the size of the embedcode and set it as css styles
        var oDiv = document.createElement('div');
        oDiv.innerHTML = sEmbedCode;
        
        
        
        // float left to give the div it's actual width and not 100% like by default
        oDiv.style.cssText = 'float:left';
        
        document.body.appendChild(oDiv);
        
        var iWidth = oDiv.offsetWidth;
        var iHeight = oDiv.offsetHeight;
        
        if (iHeight < 20){
            var aMatches = sEmbedCode.match(/height=("|')([0-9]+)("|')/g); 
            if (aMatches[0]){
                aMatches = aMatches[0].match(/([0-9]+)/g);    
            }
             if (aMatches[0]){
                 iHeight = aMatches[0];
             }
            
        }
        
        document.body.removeChild(oDiv);
        
        var sClassName = 'unknown_media';
        if (sEmbedCode.indexOf('youtube') != -1){
            sClassName = 'youtube';
        } 
        if (sEmbedCode.indexOf('player.omroep.nl') != -1){
            sClassName = 'uitzending_gemist';
        }
        if (sEmbedCode.indexOf('vimeo') != -1){
            sClassName = 'vimeo';
        }   
        if (sEmbedCode.indexOf('maps.google') != -1){
            sClassName = 'google_maps';
        }    
        if (sEmbedCode.indexOf('flickr') != -1){
            sClassName = 'flickr';
        } 
        if (sEmbedCode.indexOf('twitter') != -1){
            sClassName = 'twitter';
        } 
        if (sEmbedCode.indexOf('geostart') != -1){
            sClassName = 'geostart';
        } 
        if (sEmbedCode.indexOf('slideshare') != -1){
            sClassName = 'slideshare';
        } 
        if (sEmbedCode.indexOf('coveritlive') != -1){
            sClassName = 'coveritlive';
        }    
        if (sEmbedCode.indexOf('flash/player.swf') != -1 && sEmbedCode.indexOf('flashvars') != -1 && sEmbedCode.indexOf('.flv') != -1){
            sClassName = 'jwplayer_video';
        }      
        if (sEmbedCode.indexOf('flash/player.swf') != -1 && sEmbedCode.indexOf('flashvars') != -1 && sEmbedCode.indexOf('.mp3') != -1){
            sClassName = 'jwplayer_audio';
        }     
         
        var ed = tinyMCEPopup.editor;
        var el = ed.selection.getNode(); 
        var float = '';
        if (el.nodeName == 'DIV' && ed.dom.hasClass(el, 'media_embed')){
            // we're replacing an existing embed code
            if (ed.dom.hasClass(el, 'float_left')){
                float = 'float_left';
            }
            if (ed.dom.hasClass(el, 'float_right')){
                float = 'float_right';
            }
            
        }
        
        // Get the title with jsonp from YouTube?
        //http://gdata.youtube.com/feeds/api/videos/fs06je-VIZo?v=2&alt=json
        
        
        var sHtml = '<div style="width: ' + iWidth + 'px; height: ' + iHeight + 'px;"  class="media_embed ' + sClassName + ' ' + float + '">' + sEmbedCode + ' \n </div>\n<br id="_placeholder"><p>&nbsp;</p>';
        
        var objBookmark = ed.selection.getBookmark();
        var strPatt = '';

        ed.execCommand('mceInsertContent', false, '<br class="_mce_marker" />');

        tinymce.each( 'h1,h2,h3,h4,h5,h6,p'.split(','), function(n) {
            if (strPatt)
                strPatt += ',';

            strPatt += n + ' ._mce_marker';
        });

        tinymce.each( ed.dom.select(strPatt), function(n) {
            ed.dom.split(ed.dom.getParent(n, 'h1,h2,h3,h4,h5,h6,p'), n);
        });

        ed.dom.setOuterHTML(ed.dom.select('._mce_marker')[0], sHtml);
        
        ed.selection.moveToBookmark(objBookmark);
        var aBr = ed.dom.select('br#_placeholder');

        ed.selection.select(aBr[0]);
        ed.selection.collapse();
        
        
        tinymce.each(aBr, function(n){
            ed.dom.remove(n);
        });               
                
        
        ed.addVisual();
                
		tinyMCEPopup.close();
	}
};

tinyMCEPopup.onInit.add(EmbedDialog.init, EmbedDialog);   

