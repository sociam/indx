tinyMCEPopup.requireLangPack();

var LinkDialog = {
	preInit : function() {
		var url;

		if (url = tinyMCEPopup.getParam("external_link_list_url"))
			document.write('<script language="javascript" type="text/javascript" src="' + tinyMCEPopup.editor.documentBaseURI.toAbsolute(url) + '"></script>');
	},

	init : function() {
		var f = document.forms[0], ed = tinyMCEPopup.editor;

		// Setup browse button
		document.getElementById('hrefbrowsercontainer').innerHTML = getBrowserHTML('hrefbrowser', 'href', 'file', 'theme_ribbon_link');
		if (isVisible('hrefbrowser'))
			document.getElementById('href').style.width = '180px';

		this.fillClassList('class_list');
		this.fillFileList('link_list', 'tinyMCELinkList');
		this.fillTargetList('target_list');  
        
        if (ed.selection.getContent() == '' && !ed.dom.getParent(ed.selection.getNode(), 'A')){
            document.getElementById('linktext_container').style.display = '';
        }                    

		if (e = ed.dom.getParent(ed.selection.getNode(), 'A')) {
			f.href.value = ed.dom.getAttrib(e, 'href');
			f.linktitle.value = ed.dom.getAttrib(e, 'title');
			f.insert.value = ed.getLang('update');
			selectByValue(f, 'link_list', f.href.value);
			selectByValue(f, 'target_list', ed.dom.getAttrib(e, 'rel'));
			selectByValue(f, 'class_list', ed.dom.getAttrib(e, 'class'));
		}
	},

	update : function() {
		var f = document.forms[0], ed = tinyMCEPopup.editor, e, b, v;

        if (document.getElementById('linktext_container').style.display == '' && f.linktext.value == ''){
            // link text is empty and visible
            v = f.href.value;
            v = v.replace('http://', '');
            v = v.replace('https://', '');
            v = v.replace('mailto:', '');
            
            f.linktext.value = v;
        }
        
		tinyMCEPopup.restoreSelection();
		e = ed.dom.getParent(ed.selection.getNode(), 'A');

        
        
		// Remove element if there is no href
		if (!f.href.value) {
			if (e) {
				tinyMCEPopup.execCommand("mceBeginUndoLevel");
				b = ed.selection.getBookmark();
				ed.dom.remove(e, 1);
				ed.selection.moveToBookmark(b);
				tinyMCEPopup.execCommand("mceEndUndoLevel");
				tinyMCEPopup.close();
				return;
			}
		}

		tinyMCEPopup.execCommand("mceBeginUndoLevel");

		// Create new anchor elements
		if (e == null) {
            
            ed.getDoc().execCommand("unlink", false, null);
            
            if (f && f.linktext && f.linktext.value != ''){
                tinyMCEPopup.execCommand('mceInsertContent',false, '<a href="#mce_temp_url#">' + f.linktext.value + '</a>');
            } else {
			    
			    tinyMCEPopup.execCommand("CreateLink", false, "#mce_temp_url#", {skip_undo : 1});
            }
            
			tinymce.each(ed.dom.select("a"), function(n) {
				if (ed.dom.getAttrib(n, 'href') == '#mce_temp_url#') {
					e = n;

					ed.dom.setAttribs(e, {
						href : f.href.value,
						title : f.linktitle.value,
						rel : f.target_list ? getSelectValue(f, "target_list") : null,
						'class' : f.class_list ? getSelectValue(f, "class_list") : null
					});
				}
			});
		} else {
			ed.dom.setAttribs(e, {
				href : f.href.value,
				title : f.linktitle.value,
				rel : f.target_list ? getSelectValue(f, "target_list") : null,
				'class' : f.class_list ? getSelectValue(f, "class_list") : null
			});
		}  
        
		// Don't move caret if selection was image
		if (e && (e.childNodes.length != 1 || e.firstChild.nodeName != 'IMG')) {
			ed.focus();
			ed.selection.select(e);
			ed.selection.collapse(0);
			tinyMCEPopup.storeSelection();
		}
        
        tinymce.each(ed.dom.select("a"), function(n) {
            
            var href = ed.dom.getAttrib(n, 'href');
            
            // fix links als Tiny er een vreemde link van maakt. (Alleen naar de baseurl)
            if (href.indexOf('undefined/') != -1 || href == ''){
                n.setAttribute('mce_href', './');
                n.setAttribute('data-mce-href', './');
                n.setAttribute('href', './');
            }
        
            
        });
        

		tinyMCEPopup.execCommand("mceEndUndoLevel");
		tinyMCEPopup.close();
        
        
        
	},

	checkPrefix : function(n) {
		if (n.value && Validator.isEmail(n) && !/^\s*mailto:/i.test(n.value)) //  && confirm(tinyMCEPopup.getLang('ribbon_dlg.link_is_email'))
			n.value = 'mailto:' + n.value;

		if (/^\s*www\./i.test(n.value)) //  && confirm(tinyMCEPopup.getLang('ribbon_dlg.link_is_external'))
			n.value = 'http://' + n.value;
	},
    
    updateText : function (n){
        
        var t, v, tl, vl;
        
        t = document.getElementById('linktext');
        if (document.getElementById('linktext_container').style.display == ''){
            // link text is visible
            v = n.value;
            v = v.replace('http://', '');
            v = v.replace('https://', '');
            v = v.replace('mailto:', '');
            
            // trim it
            v = v.replace(/^\s+/,'');
            v = v.replace(/\s+$/,'');
            
            vl = v.length;
            tl = t.value.length;
            
            if ((!LinkDialog.textChanged || tl == 0) && (t.value == '' || t.value.substr(0, vl) == v || v.substr(0, tl) == t.value)){
                t.value = v;
            }
            
        }
        
    },

	fillFileList : function(id, l) {
		var dom = tinyMCEPopup.dom, lst = dom.get(id), v, cl;

		l = window[l];

		if (l && l.length > 0) {
			lst.options[lst.options.length] = new Option('', '');

			tinymce.each(l, function(o) {
				lst.options[lst.options.length] = new Option(o[0], o[1]);
			});
		} else
			dom.remove(dom.getParent(id, 'tr'));
	},

	fillClassList : function(id) {
		var dom = tinyMCEPopup.dom, lst = dom.get(id), v, cl;

		if (v = tinyMCEPopup.getParam('theme_ribbon_styles')) {
			cl = [];

			tinymce.each(v.split(';'), function(v) {
				var p = v.split('=');

				cl.push({'title' : p[0], 'class' : p[1]});
			});
		} else
			cl = tinyMCEPopup.editor.dom.getClasses();

		if (cl.length > 0) {
			lst.options[lst.options.length] = new Option(tinyMCEPopup.getLang('not_set'), '');

			tinymce.each(cl, function(o) {
				lst.options[lst.options.length] = new Option(o.title || o['class'], o['class']);
			});
		} else
			dom.remove(dom.getParent(id, 'tr'));
	},

	fillTargetList : function(id) {
		var dom = tinyMCEPopup.dom, lst = dom.get(id), v;

		//lst.options[lst.options.length] = new Option(tinyMCEPopup.getLang('not_set'), '');
		lst.options[lst.options.length] = new Option(tinyMCEPopup.getLang('ribbon_dlg.link_target_same'), '');
		lst.options[lst.options.length] = new Option(tinyMCEPopup.getLang('ribbon_dlg.link_target_blank'), 'external');

		if (v = tinyMCEPopup.getParam('theme_ribbon_link_targets')) {
			tinymce.each(v.split(','), function(v) {
				v = v.split('=');
				lst.options[lst.options.length] = new Option(v[0], v[1]);
			});
		}
	}
};

LinkDialog.preInit();
tinyMCEPopup.onInit.add(LinkDialog.init, LinkDialog);
