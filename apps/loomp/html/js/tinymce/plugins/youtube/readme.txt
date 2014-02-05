YouTube TinyMCE plugin v1.0
Written by Adrian Hope-Bailie
Based on Flash Plugin by Moxiecode

Currently this plugin will NOT play nice with the flash plugin, but this should be resolved in v1.1

INSTALL:
To install simply place entire "youtube" folder in the "tinymce\jscripts\tiny_mce\plugins" folder.

To add context menu support edit the file "tinymce\jscripts\tiny_mce\plugins\contextmenu\editor_plugin.js" 

Find the code that reads:

if(tinyMCE.getAttrib(elm,'class').indexOf('mceItemFlash')!=-1)contextMenu.addItem(tinyMCE.baseURL+"/plugins/flash/images/flash.gif","$lang_flash_props","mceFlash");

Insert the following code immediately afterwards:

else if (tinyMCE.getAttrib(elm, 'class').indexOf('mceItemYouTube') != -1)contextMenu.addItem(tinyMCE.baseURL + "/plugins/youtube/images/youtube.gif", "$lang_youtube_props", "mceYouTube");
