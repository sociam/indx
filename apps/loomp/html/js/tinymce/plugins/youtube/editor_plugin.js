tinyMCE.importPluginLanguagePack('youtube','en,tr,de,sv,zh_cn,cs,fa,fr_ca,fr,pl,pt_br,nl,da,he,nb,hu,ru,ru_KOI8-R,ru_UTF-8,nn,es,cy,is,zh_tw,zh_tw_utf8,sk,pt_br');
var TinyMCE_YouTubePlugin={
		getInfo:function(){
			return{
					longname:'YouTube',author:'Adrian Hope-Bailie',authorurl:'http://www.digitsolutions.co.za',infourl:'http://www.digitsolutions/tinymce/docs/plugin_youtube.html',version:tinyMCE.majorVersion+"."+tinyMCE.minorVersion};
		},
		initInstance:function(inst){
			if(!tinyMCE.settings['youtube_skip_plugin_css'])
					tinyMCE.importCSS(inst.getDoc(),tinyMCE.baseURL+"/plugins/youtube/css/content.css");
		},
		getControlHTML:function(cn){
			switch(cn){
				case"youtube":
					return tinyMCE.getButtonHTML(cn,'lang_youtube_desc','{$pluginurl}/images/youtube.gif','mceYouTube');
			}
			return"";
		},
		execCommand:function(editor_id,element,command,user_interface,value){
			switch(command){
				case"mceYouTube":
					var name="",swffile="",swfwidth="",swfheight="",action="insert";
					var template=new Array();
					var inst=tinyMCE.getInstanceById(editor_id);
					var focusElm=inst.getFocusElement();
					template['file']='../../plugins/youtube/youtube.htm';
					template['width']=430;
					template['height']=175;
					template['width']+=tinyMCE.getLang('lang_youtube_delta_width',0);
					template['height']+=tinyMCE.getLang('lang_youtube_delta_height',0);
					
					if(focusElm!=null&&focusElm.nodeName.toLowerCase()=="img"){
						name=tinyMCE.getAttrib(focusElm,'class');
						if(name.indexOf('mceItemYouTube')==-1)
							return true;
						swffile=tinyMCE.getAttrib(focusElm,'alt');
						
						//if(tinyMCE.getParam('convert_urls'))
						//	swffile=eval(tinyMCE.settings['urlconverter_callback']+"(swffile, null, true);");
						
						swfwidth=tinyMCE.getAttrib(focusElm,'width');
						swfheight=tinyMCE.getAttrib(focusElm,'height');
						action="update";
					}
					
					tinyMCE.openWindow(template,{
									   editor_id:editor_id,
									   inline:"yes",
									   swffile:swffile,
									   swfwidth:swfwidth,
									   swfheight:swfheight,
									   action:action});
					return true;
			}
			return false;
		},
		cleanup:function(type,content){
			switch(type){
				case"insert_to_editor_dom":
					if(tinyMCE.getParam('convert_urls')){
						var imgs=content.getElementsByTagName("img");
						for(var i=0; i<imgs.length; i++){
							if(tinyMCE.getAttrib(imgs[i],"class")=="mceItemYouTube"){
								var src=tinyMCE.getAttrib(imgs[i],"alt");
								//if(tinyMCE.getParam('convert_urls'))
								//	src=eval(tinyMCE.settings['urlconverter_callback']+"(src, null, true);");
								imgs[i].setAttribute('alt',src);
								imgs[i].setAttribute('title',src);
							}
						}
					}
					break;
					
				case"get_from_editor_dom":
					var imgs=content.getElementsByTagName("img");
					for(var i=0; i<imgs.length;i++){
						if(tinyMCE.getAttrib(imgs[i],"class")=="mceItemYouTube"){
							var src=tinyMCE.getAttrib(imgs[i],"alt");
							//if(tinyMCE.getParam('convert_urls'))
							//	src=eval(tinyMCE.settings['urlconverter_callback']+"(src, null, true);");
							imgs[i].setAttribute('alt',src);
							imgs[i].setAttribute('title',src);
						}
					}
					break;
					
				case"insert_to_editor":
					var startPos=0;
					var embedList=new Array();
					content=content.replace(new RegExp('<[ ]*embed','gi'),'<embed');
					content=content.replace(new RegExp('<[ ]*/embed[ ]*>','gi'),'</embed>');
					content=content.replace(new RegExp('<[ ]*object','gi'),'<object');
					content=content.replace(new RegExp('<[ ]*/object[ ]*>','gi'),'</object>');
					while((startPos=content.indexOf('<embed',startPos+1))!=-1){
						var endPos=content.indexOf('>',startPos);
						var attribs=TinyMCE_YouTubePlugin._parseAttributes(content.substring(startPos+6,endPos));
						//Ensure this is a YouTube Video and not just a regular flash video
						if(content.substring(startPos+6,endPos).indexOf(tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/'))!=-1)
							embedList[embedList.length]=attribs;
					}
					var index=0;
					while((startPos=content.indexOf('<object',startPos))!=-1){
						if(index>=embedList.length)
							break;
					
						var attribs=embedList[index];
						endPos=content.indexOf('</object>',startPos);
						
						//Ensure this is a YouTube Video and not just a regular flash video
						if(content.substring(startPos+7,endPos).indexOf(tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/'))!=-1){
							endPos+=9;
							var contentAfter=content.substring(endPos);
							attribs["src"] = attribs["src"].replace(new RegExp(tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/'),'gi'),'');
							content=content.substring(0,startPos);
							content+='<img width="'+attribs["width"]+'" height="'+attribs["height"]+'"';
							content+=' src="'+(tinyMCE.getParam("theme_href")+'/images/spacer.gif')+'" title="'+attribs["src"]+'"';
							content+=' alt="'+attribs["src"]+'" class="mceItemYouTube" />'+content.substring(endPos);
							content+=contentAfter;
							index++;
						}
						startPos++;
					}
					
					var index=0;
					while((startPos=content.indexOf('<embed',startPos))!=-1){
						if(index>=embedList.length)
							break;
						var attribs=embedList[index];
						endPos=content.indexOf('>',startPos);
						//Ensure this is a YouTube Video and not just a regular flash video
						if(content.substring(startPos+7,endPos).indexOf(tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/'))!=-1){
							endPos+=9;
							var contentAfter=content.substring(endPos);
							attribs["src"] = attribs["src"].replace(new RegExp(tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/'),'gi'),'');
							content=content.substring(0,startPos);
							content+='<img width="'+attribs["width"]+'" height="'+attribs["height"]+'"';
							content+=' src="'+(tinyMCE.getParam("theme_href")+'/images/spacer.gif')+'" title="'+attribs["src"]+'"';
							content+=' alt="'+attribs["src"]+'" class="mceItemYouTube" />'+content.substring(endPos);
							content+=contentAfter;
							index++;
						}
						startPos++;
					}
					break;
					
				case"get_from_editor":
					var startPos=-1;
					while((startPos=content.indexOf('<img',startPos+1))!=-1){
						var endPos=content.indexOf('/>',startPos);
						var attribs=TinyMCE_YouTubePlugin._parseAttributes(content.substring(startPos+4,endPos));
						if(attribs['class']!="mceItemYouTube")
							continue;
						endPos+=2;
						var embedHTML='';
						var wmode=tinyMCE.getParam("youtube_wmode","");
						var url_prefix = tinyMCE.getParam('youtube_url_prefix','http://www.youtube.com/v/');
						embedHTML+='<object';
						embedHTML+=' width="'+attribs["width"]+'" height="'+attribs["height"]+'">';
						embedHTML+='<param name="movie" value="'+url_prefix+attribs["title"]+'" />';
						embedHTML+='<param name="wmode" value="'+wmode+'" />';
						embedHTML+='<embed src="'+url_prefix+attribs["title"]+'" wmode="'+wmode+'" type="application/x-shockwave-flash" width="'+attribs["width"]+'" height="'+attribs["height"]+'"></embed></object>';
						chunkBefore=content.substring(0,startPos);
						chunkAfter=content.substring(endPos);
						content=chunkBefore+embedHTML+chunkAfter;
					}
					break;
			}
			return content;
		},
		handleNodeChange:function(editor_id,node,undo_index,undo_levels,visual_aid,any_selection){
			if(node==null)
				return;
			do{
				if(node.nodeName=="IMG"&&tinyMCE.getAttrib(node,'class').indexOf('mceItemYouTube')==0){
					tinyMCE.switchClass(editor_id+'_youtube','mceButtonSelected');
					return true;
				}
			}
			while((node=node.parentNode));
			
			tinyMCE.switchClass(editor_id+'_youtube','mceButtonNormal');
			return true;
		},
		_parseAttributes:function(attribute_string){
			var attributeName="";
			var attributeValue="";
			var withInName;
			var withInValue;
			var attributes=new Array();
			var whiteSpaceRegExp=new RegExp('^[ \n\r\t]+','g');
			if(attribute_string==null||attribute_string.length<2)
				return null;
			withInName=withInValue=false;
			for(var i=0; i<attribute_string.length; i++){
				var chr=attribute_string.charAt(i);
				if((chr=='"'||chr=="'")&&!withInValue)
					withInValue=true;
				else if((chr=='"'||chr=="'")&&withInValue){
					withInValue=false;
					var pos=attributeName.lastIndexOf(' ');
					if(pos!=-1)
						attributeName=attributeName.substring(pos+1);
					attributes[attributeName.toLowerCase()]=attributeValue.substring(1);
					attributeName="";
					attributeValue="";
				}
				else if(!whiteSpaceRegExp.test(chr)&&!withInName&&!withInValue)
					withInName=true;

				if(chr=='='&&withInName)
					withInName=false;
				if(withInName)
					attributeName+=chr;
				if(withInValue)
					attributeValue+=chr;
			}
			return attributes;
		}
	};
tinyMCE.addPlugin("youtube",TinyMCE_YouTubePlugin);
