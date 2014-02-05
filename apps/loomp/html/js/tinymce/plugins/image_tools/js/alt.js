tinyMCEPopup.requireLangPack();

var ImageAltDialog = {
    init : function() {
        var f = document.forms[0];
        
        el = tinyMCEPopup.editor.selection.getNode();  
        
        
        f.image_alt.value = el.alt;
    },

    insert : function() {
        
        var sAlt = document.forms[0].image_alt.value;
        
        el = tinyMCEPopup.editor.selection.getNode();    
        el.alt = sAlt;
        

        tinyMCEPopup.close();
    }
};

tinyMCEPopup.onInit.add(ImageAltDialog.init, ImageAltDialog);   

