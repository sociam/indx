/**
 * editor_template.js
 *
 * Ribbon theme
 * 
 * Based on the advanced theme (Copyright Moxiecode 2009-2011)
 * 
 * Copyright 2011, Vincent Kleijnendorst - SWIS BV
 * Released under LGPL License.
 *
 */
 

(function(tinymce) {

    
	var DOM = tinymce.DOM, Event = tinymce.dom.Event, extend = tinymce.extend, each = tinymce.each, Cookie = tinymce.util.Cookie, lastExtID, explode = tinymce.explode;
    
	// Tell it to load theme specific language pack(s)
	tinymce.ThemeManager.requireLangPack('ribbon');

	tinymce.create('tinymce.themes.RibbonTheme', {
        
        
		sizes : [8, 10, 12, 14, 18, 24, 36],

		// Control name lookup, format: title, command, ???, ???, label, big (true/false)
		controls : {
			bold : ['bold_desc', 'Bold'],
			italic : ['italic_desc', 'Italic'],
			underline : ['underline_desc', 'Underline'],
			strikethrough : ['striketrough_desc', 'Strikethrough'],
			justifyleft : ['justifyleft_desc', 'JustifyLeft'],
			justifycenter : ['justifycenter_desc', 'JustifyCenter'],
			justifyright : ['justifyright_desc', 'JustifyRight'],
			justifyfull : ['justifyfull_desc', 'JustifyFull'],
            
            paragraph : ['paragraph_desc', 'mceParagraph', null, null, 'paragraph_label', true],
            heading1 : ['h1', 'mceHeading1', null, null, 'h1_label', true],
            heading2 : ['h2', 'mceHeading2', null, null, 'h2_label', true],
            heading3 : ['h3', 'mceHeading3', null, null, 'h3_label', true],
            heading4 : ['h4', 'mceHeading4', null, null, 'h4_label', true],
            heading5 : ['h5', 'mceHeading5', null, null, 'h5_label', true],
            heading6 : ['h6', 'mceHeading6', null, null, 'h6_label', true],
            
			bullist : ['bullist_desc', 'InsertUnorderedList'],
			numlist : ['numlist_desc', 'InsertOrderedList'],
			outdent : ['outdent_desc', 'Outdent'],
			indent : ['indent_desc', 'Indent'],
			cut : ['cut_desc', 'Cut'],
			copy : ['copy_desc', 'Copy'],
			paste : ['paste_desc', 'Paste', null, null, 'paste_label', true],
			undo : ['undo_desc', 'Undo'],
			redo : ['redo_desc', 'Redo'],
			link : ['link_desc', 'mceLink', null, null, 'link_label'],
			unlink : ['unlink_desc', 'unlink', null, null, 'unlink_label'],
			image : ['image_desc', 'mceImage', null, null, 'image_label', true],
			cleanup : ['cleanup_desc', 'mceCleanup', null, null, 'cleanup_label'],
			help : ['help_desc', 'mceHelp'],
			code : ['code_desc', 'mceCodeEditor'],
			hr : ['hr_desc', 'InsertHorizontalRule', null, null, 'hr_label'],
			removeformat : ['removeformat_desc', 'RemoveFormat', null, null, 'removeformat_label'],
			sub : ['sub_desc', 'subscript'],
			sup : ['sup_desc', 'superscript'],
			forecolor : ['forecolor_desc', 'ForeColor'],
			forecolorpicker : ['forecolor_desc', 'mceForeColor'],
			backcolor : ['backcolor_desc', 'HiliteColor'],
			backcolorpicker : ['backcolor_desc', 'mceBackColor'],
			charmap : ['charmap_desc', 'mceCharMap', null, null, 'charmap_label'],
			visualaid : ['visualaid_desc', 'mceToggleVisualAid'],
			anchor : ['anchor_desc', 'mceInsertAnchor', null, null, 'anchor_label'],
			newdocument : ['newdocument_desc', 'mceNewDocument'],
			blockquote : ['blockquote_desc', 'mceBlockQuote']
		},

		stateControls : ['bold', 'italic', 'underline', 'strikethrough', 'bullist', 'numlist', 'justifyleft', 'justifycenter', 'justifyright', 'justifyfull', 'sub', 'sup', 'blockquote'],

		init : function(ed, url) {
			var t = this, s, v, o;
	
			t.editor = ed;
			t.url = url;
			t.onResolveName = new tinymce.util.Dispatcher(this);

			// Default settings
			t.settings = s = extend({
                
                theme_ribbon_statusbar_location : "bottom",
                                            
                theme_ribbon_tab1 : {   title : "Start",
                                        items : [
                                                ["paste"], 
                                                ["justifyleft,justifycenter,justifyright,justifyfull",
                                                 "bullist,numlist",
                                                 "|",
                                                 "bold,italic,underline",
                                                 "outdent,indent"], 
                                                ["paragraph", "heading1", "heading2", "heading3"],
                                                ["search", "|", "replace", "|", "removeformat"]]
                                    },
                                    

                                    
                theme_ribbon_tab2 : {   title : "Insert",
                                        items : [["tabledraw"],
                                                ["image", "bestandsbeheer_file", "bestandsbeheer_video", "bestandsbeheer_mp3"],
                                                ["embed"],
                                                ["link", "|", "unlink", "|", "anchor"],
                                                ["loremipsum", "|", "charmap", "|", "hr"]]
                                    },
                
                theme_ribbon_tab3 : {   title : "Source",
                                        source : true
                    
                                    },
                
                theme_ribbon_tab4 : {   title : "Image",
                                        bind :  "img",
                                        items : [["image_float_left", "image_float_right", "image_float_none"],
                                                ["image_alt"],
                                                ["image_width_plus", "|", "image_width_min", "|", "image_width_original"],     
                                                ["image_edit", "|", "image_remove"]]
                                    },   
                                    
                theme_ribbon_tab5 : {   title : "Table",
                                        bind :  "table",
                                        items : [["delete_table", "|", "delete_col", "|", "delete_row"], 
                                                ["col_before", "|", "col_after"],
                                                ["row_before", "|", "row_after"]]
                                    }, 
                                    
                theme_ribbon_tab6 : {   title : "Embed",
                                        bind :  "div.media_embed",
                                        items : [["embed_float_left", "embed_float_right", "embed_float_none"],
                                                ["embed_resize_plus", "|", "embed_resize_min"],
                                                ["embed_edit", "|", "embed_remove"]]
                                    },
                                    
                
				theme_ribbon_path : true,
				theme_ribbon_blockformats : "p,address,pre,h1,h2,h3,h4,h5,h6",
				theme_ribbon_toolbar_align : "center",
				theme_ribbon_fonts : "Andale Mono=andale mono,times;Arial=arial,helvetica,sans-serif;Arial Black=arial black,avant garde;Book Antiqua=book antiqua,palatino;Comic Sans MS=comic sans ms,sans-serif;Courier New=courier new,courier;Georgia=georgia,palatino;Helvetica=helvetica;Impact=impact,chicago;Symbol=symbol;Tahoma=tahoma,arial,helvetica,sans-serif;Terminal=terminal,monaco;Times New Roman=times new roman,times;Trebuchet MS=trebuchet ms,geneva;Verdana=verdana,geneva;Webdings=webdings;Wingdings=wingdings,zapf dingbats",
				theme_ribbon_more_colors : 1,
				theme_ribbon_row_height : 23,
				theme_ribbon_resize_horizontal : 1,
                theme_ribbon_resizing : true,
				theme_ribbon_resizing_use_cookie : 1,
				theme_ribbon_font_sizes : "1,2,3,4,5,6,7",
				readonly : ed.settings.readonly,
                theme_ribbon_fancy_source : ed.settings.ribbon_fancy_source || true,
                extended_valid_elements : "iframe[title|src|style|width|height|scrolling|marginwidth|marginheight|frameborder],object[type|data|classid|width|height|codebase|*],param[name|value|_value|],embed[pluginspage|type|quality|flashvars|href|type|width|height|src]",
                element_format : "html",
                tab_focus : ":prev,:next"  
                
                
			}, ed.settings);

			// Setup default font_size_style_values
			if (!s.font_size_style_values)
				s.font_size_style_values = "8pt,10pt,12pt,14pt,18pt,24pt,36pt";

			if (tinymce.is(s.theme_ribbon_font_sizes, 'string')) {
				s.font_size_style_values = tinymce.explode(s.font_size_style_values);
				s.font_size_classes = tinymce.explode(s.font_size_classes || '');

				// Parse string value
				o = {};
				ed.settings.theme_ribbon_font_sizes = s.theme_ribbon_font_sizes;
				each(ed.getParam('theme_ribbon_font_sizes', '', 'hash'), function(v, k) {
					var cl;

					if (k == v && v >= 1 && v <= 7) {
						k = v + ' (' + t.sizes[v - 1] + 'pt)';
						cl = s.font_size_classes[v - 1];
						v = s.font_size_style_values[v - 1] || (t.sizes[v - 1] + 'pt');
					}

					if (/^\s*\./.test(v))
						cl = v.replace(/\./g, '');

					o[k] = cl ? {'class' : cl} : {fontSize : v};
				});

				s.theme_ribbon_font_sizes = o;
			}

			if ((v = s.theme_ribbon_path_location) && v != 'none')
				s.theme_ribbon_statusbar_location = s.theme_ribbon_path_location;

			if (s.theme_ribbon_statusbar_location == 'none')
				s.theme_ribbon_statusbar_location = 0;
                
			// Init editor
			ed.onInit.add(function() {
				if (!ed.settings.readonly)
					ed.onNodeChange.add(t._nodeChanged, t);

				if (ed.settings.content_css !== false)
					ed.dom.loadCSS(ed.baseURI.toAbsolute(url + "/skins/" + ed.settings.skin + "/content.css"));
			});

			ed.onSetProgressState.add(function(ed, b, ti) {
				var co, id = ed.id, tb;

				if (b) {
					t.progressTimer = setTimeout(function() {
						co = ed.getContainer();
						co = co.insertBefore(DOM.create('DIV', {style : 'position:relative'}), co.firstChild);
						tb = DOM.get(ed.id + '_tbl');

						DOM.add(co, 'div', {id : id + '_blocker', 'class' : 'mceBlocker', style : {width : tb.clientWidth + 2, height : tb.clientHeight + 2}});
						DOM.add(co, 'div', {id : id + '_progress', 'class' : 'mceProgress', style : {left : tb.clientWidth / 2, top : tb.clientHeight / 2}});
					}, ti || 0);
				} else {
					DOM.remove(id + '_blocker');
					DOM.remove(id + '_progress');
					clearTimeout(t.progressTimer);
				}
			});

			DOM.loadCSS(s.editor_css ? ed.documentBaseURI.toAbsolute(s.editor_css) : url + "/skins/" + ed.settings.skin + "/ui.css");

			if (s.skin_variant) {
				DOM.loadCSS(url + "/skins/" + ed.settings.skin + "/ui_" + s.skin_variant + ".css");
            }
            this._addDefaultButtons();
		},
        
        
        /**
        *   Add the default buttons to the ribbon
        */
        _addDefaultButtons : function(){
            
            var i, ed = this.editor;
            
            ed.addCommand('mceParagraph', function() {ed.execCommand('formatBlock', false, 'p');});   
            ed.addButton('paragraph');
            
            ed.addCommand('mceHeading1', function() {ed.execCommand('formatBlock', false, 'h1');});   
            ed.addButton('heading1');
            ed.addCommand('mceHeading2', function() {ed.execCommand('formatBlock', false, 'h2');});   
            ed.addButton('heading2');
            ed.addCommand('mceHeading3', function() {ed.execCommand('formatBlock', false, 'h3');});   
            ed.addButton('heading3');
            ed.addCommand('mceHeading4', function() {ed.execCommand('formatBlock', false, 'h4');});   
            ed.addButton('heading4');
            ed.addCommand('mceHeading5', function() {ed.execCommand('formatBlock', false, 'h5');});   
            ed.addButton('heading5');
            ed.addCommand('mceHeading6', function() {ed.execCommand('formatBlock', false, 'h6');});   
            ed.addButton('heading6');
            
        },
        
        /**
        *  Get button DOM node by name
        */
        _getButton : function(name){
            
            var id = this.editor.editorId + '_' + name;
            return DOM.get(id);
            
        },
        

		createControl : function(n, cf) {
			var cd, c;

			if (c = cf.createControl(n))
				return c;

			switch (n) {
				case "styleselect":
					return this._createStyleSelect();

				case "formatselect":
					return this._createBlockFormats();

				case "fontselect":
					return this._createFontSelect();

				case "fontsizeselect":
					return this._createFontSizeSelect();

				case "forecolor":
					return this._createForeColorMenu();

				case "backcolor":
					return this._createBackColorMenu();
			}

			if ((cd = this.controls[n])){
                var label = cd[4] ? this.editor.translate('ribbon.' + cd[4]) : '';
                var big = (cd[5] && cd[5] == true) ? ' big' : ''; 
                
				return cf.createButton(n, {'class' : 'mce_' + n + big, title : "ribbon." + cd[0], cmd : cd[1], ui : cd[2], value : cd[3], label : label});
            } 
		},

		execCommand : function(cmd, ui, val) {
			var f = this['_' + cmd];

			if (f) {
				f.call(this, ui, val);
				return true;
			}

			return false;
		},

		_importClasses : function(e) {
			var ed = this.editor, ctrl = ed.controlManager.get('styleselect');

			if (ctrl.getLength() == 0) {
				each(ed.dom.getClasses(), function(o, idx) {
					var name = 'style_' + idx;

					ed.formatter.register(name, {
						inline : 'span',
						attributes : {'class' : o['class']},
						selector : '*'
					});

					ctrl.add(o['class'], name);
				});
			}
		},

		_createStyleSelect : function(n) {
			var t = this, ed = t.editor, ctrlMan = ed.controlManager, ctrl;

			// Setup style select box
			ctrl = ctrlMan.createListBox('styleselect', {
				title : 'ribbon.style_select',
				onselect : function(name) {
					var matches, formatNames = [];

					each(ctrl.items, function(item) {
						formatNames.push(item.value);
					});

					ed.focus();
					ed.undoManager.add();

					// Toggle off the current format
					matches = ed.formatter.matchAll(formatNames);
					if (!name || matches[0] == name)
						ed.formatter.remove(matches[0]);
					else
						ed.formatter.apply(name);

					ed.undoManager.add();
					ed.nodeChanged();

					return false; // No auto select
				}
			});

			// Handle specified format
			ed.onInit.add(function() {
				var counter = 0, formats = ed.getParam('style_formats');

				if (formats) {
					each(formats, function(fmt) {
						var name, keys = 0;

						each(fmt, function() {keys++;});

						if (keys > 1) {
							name = fmt.name = fmt.name || 'style_' + (counter++);
							ed.formatter.register(name, fmt);
							ctrl.add(fmt.title, name);
						} else
							ctrl.add(fmt.title);
					});
				} else {
					each(ed.getParam('theme_ribbon_styles', '', 'hash'), function(val, key) {
						var name;

						if (val) {
							name = 'style_' + (counter++);

							ed.formatter.register(name, {
								inline : 'span',
								classes : val,
								selector : '*'
							});

							ctrl.add(t.editor.translate(key), name);
						}
					});
				}
			});

			// Auto import classes if the ctrl box is empty
			if (ctrl.getLength() == 0) {
				ctrl.onPostRender.add(function(ed, n) {
					if (!ctrl.NativeListBox) {
						Event.add(n.id + '_text', 'focus', t._importClasses, t);
						Event.add(n.id + '_text', 'mousedown', t._importClasses, t);
						Event.add(n.id + '_open', 'focus', t._importClasses, t);
						Event.add(n.id + '_open', 'mousedown', t._importClasses, t);
					} else
						Event.add(n.id, 'focus', t._importClasses, t);
				});
			}

			return ctrl;
		},

		_createFontSelect : function() {
			var c, t = this, ed = t.editor;

			c = ed.controlManager.createListBox('fontselect', {
				title : 'ribbon.fontdefault',
				onselect : function(v) {
					var cur = c.items[c.selectedIndex];

					if (!v && cur) {
						ed.execCommand('FontName', false, cur.value);
						return;
					}

					ed.execCommand('FontName', false, v);

					// Fake selection, execCommand will fire a nodeChange and update the selection
					c.select(function(sv) {
						return v == sv;
					});

					return false; // No auto select
				}
			});

			if (c) {
				each(ed.getParam('theme_ribbon_fonts', t.settings.theme_ribbon_fonts, 'hash'), function(v, k) {
					c.add(ed.translate(k), v, {style : v.indexOf('dings') == -1 ? 'font-family:' + v : ''});
				});
			}

			return c;
		},

		_createFontSizeSelect : function() {
			var t = this, ed = t.editor, c, i = 0, cl = [];

			c = ed.controlManager.createListBox('fontsizeselect', {title : 'ribbon.font_size', onselect : function(v) {
				var cur = c.items[c.selectedIndex];

				if (!v && cur) {
					cur = cur.value;

					if (cur['class']) {
						ed.formatter.toggle('fontsize_class', {value : cur['class']});
						ed.undoManager.add();
						ed.nodeChanged();
					} else {
						ed.execCommand('FontSize', false, cur.fontSize);
					}

					return;
				}

				if (v['class']) {
					ed.focus();
					ed.undoManager.add();
					ed.formatter.toggle('fontsize_class', {value : v['class']});
					ed.undoManager.add();
					ed.nodeChanged();
				} else
					ed.execCommand('FontSize', false, v.fontSize);

				// Fake selection, execCommand will fire a nodeChange and update the selection
				c.select(function(sv) {
					return v == sv;
				});

				return false; // No auto select
			}});

			if (c) {
				each(t.settings.theme_ribbon_font_sizes, function(v, k) {
					var fz = v.fontSize;

					if (fz >= 1 && fz <= 7)
						fz = t.sizes[parseInt(fz) - 1] + 'pt';

					c.add(k, v, {'style' : 'font-size:' + fz, 'class' : 'mceFontSize' + (i++) + (' ' + (v['class'] || ''))});
				});
			}

			return c;
		},

		_createBlockFormats : function() {
			var c, fmts = {
				p : 'ribbon.paragraph',
				address : 'ribbon.address',
				pre : 'ribbon.pre',
				h1 : 'ribbon.h1',
				h2 : 'ribbon.h2',
				h3 : 'ribbon.h3',
				h4 : 'ribbon.h4',
				h5 : 'ribbon.h5',
				h6 : 'ribbon.h6',
				div : 'ribbon.div',
				blockquote : 'ribbon.blockquote',
				code : 'ribbon.code',
				dt : 'ribbon.dt',
				dd : 'ribbon.dd',
				samp : 'ribbon.samp'
			}, t = this;

			c = t.editor.controlManager.createListBox('formatselect', {title : 'ribbon.block', cmd : 'FormatBlock'});
			if (c) {
				each(t.editor.getParam('theme_ribbon_blockformats', t.settings.theme_ribbon_blockformats, 'hash'), function(v, k) {
					c.add(t.editor.translate(k != v ? k : fmts[v]), v, {'class' : 'mce_formatPreview mce_' + v});
				});
			}

			return c;
		},

		_createForeColorMenu : function() {
			var c, t = this, s = t.settings, o = {}, v;

			if (s.theme_ribbon_more_colors) {
				o.more_colors_func = function() {
					t._mceColorPicker(0, {
						color : c.value,
						func : function(co) {
							c.setColor(co);
						}
					});
				};
			}

			if (v = s.theme_ribbon_text_colors)
				o.colors = v;

			if (s.theme_ribbon_default_foreground_color)
				o.default_color = s.theme_ribbon_default_foreground_color;

			o.title = 'ribbon.forecolor_desc';
			o.cmd = 'ForeColor';
			o.scope = this;

			c = t.editor.controlManager.createColorSplitButton('forecolor', o);

			return c;
		},

		_createBackColorMenu : function() {
			var c, t = this, s = t.settings, o = {}, v;

			if (s.theme_ribbon_more_colors) {
				o.more_colors_func = function() {
					t._mceColorPicker(0, {
						color : c.value,
						func : function(co) {
							c.setColor(co);
						}
					});
				};
			}

			if (v = s.theme_ribbon_background_colors)
				o.colors = v;

			if (s.theme_ribbon_default_background_color)
				o.default_color = s.theme_ribbon_default_background_color;

			o.title = 'ribbon.backcolor_desc';
			o.cmd = 'HiliteColor';
			o.scope = this;

			c = t.editor.controlManager.createColorSplitButton('backcolor', o);

			return c;
		},

		renderUI : function(o) {
			var n, ic, tb, t = this, ed = t.editor, s = t.settings, sc, p, nl;

			n = p = DOM.create('span', {id : ed.id + '_parent', 'class' : 'mceEditor ' + ed.settings.skin + 'Skin' + (s.skin_variant ? ' ' + ed.settings.skin + 'Skin' + t._ufirst(s.skin_variant) : '')});

			if (!DOM.boxModel)
				n = DOM.add(n, 'div', {'class' : 'mceOldBoxModel'});

			n = sc = DOM.add(n, 'table', {id : ed.id + '_tbl', 'class' : 'mceLayout', cellSpacing : 0, cellPadding : 0});
			n = tb = DOM.add(n, 'tbody');

            ic = t._simpleLayout(s, tb, o, p);

			n = o.targetNode;

			// Add classes to first and last TRs
			nl = DOM.stdMode ? sc.getElementsByTagName('tr') : sc.rows; // Quick fix for IE 8
			DOM.addClass(nl[0], 'mceFirst');
			DOM.addClass(nl[nl.length - 1], 'mceLast');

			// Add classes to first and last TDs
			each(DOM.select('tr', tb), function(n) {
				DOM.addClass(n.firstChild, 'mceFirst');
                if(n.childNodes && n.childNodes.length > 1){
				    DOM.addClass(n.childNodes[n.childNodes.length - 1], 'mceLast');
                }
			});

			if (DOM.get(s.theme_ribbon_toolbar_container))
				DOM.get(s.theme_ribbon_toolbar_container).appendChild(p);
			else
				DOM.insertAfter(p, n);

			Event.add(ed.id + '_path_row', 'click', function(e) {
				e = e.target;

				if (e.nodeName == 'A') {
					t._sel(e.className.replace(/^.*mcePath_([0-9]+).*$/, '$1'));

					return Event.cancel(e);
				}
			});


			if (!ed.getParam('accessibility_focus'))
				Event.add(DOM.add(p, 'a', {href : '#'}, '<!-- IE -->'), 'focus', function() {tinyMCE.get(ed.id).focus();});

            /*    
			if (s.theme_ribbon_toolbar_location == 'external')
				o.deltaHeight = 0;
            */
			t.deltaHeight = o.deltaHeight;
			o.targetNode = null;

			return {
				iframeContainer : ic,
				editorContainer : ed.id + '_parent',
				sizeContainer : sc,
				deltaHeight : o.deltaHeight
			};
		},

		getInfo : function() {
			return {
				longname : 'Ribbon theme',
				author : 'SWIS BV - V. Kleijnendorst',
				authorurl : 'http://www.swis.nl',
				version : tinymce.majorVersion + "." + tinymce.minorVersion
			}
		},

		resizeBy : function(dw, dh) {
			var e = DOM.get(this.editor.id + '_tbl');

			this.resizeTo(e.clientWidth + dw, e.clientHeight + dh);
		},

		resizeTo : function(w, h, store) {
			var ed = this.editor, s = this.settings, e = DOM.get(ed.id + '_tbl'), ifr = DOM.get(ed.id + '_ifr');
            var source = DOM.get(ed.id + '_sourceEditor');
            
            if (source && !DOM.hasClass(source, 'hidden')){ 
                // no resizing when editing source
                return;
                
                // could be done when setting the width and height of the textarea. To buggy for now.
            }

			// Boundery fix box
			w = Math.max(s.theme_ribbon_resizing_min_width || 100, w);
			h = Math.max(s.theme_ribbon_resizing_min_height || 100, h);
			w = Math.min(s.theme_ribbon_resizing_max_width || 0xFFFF, w);
			h = Math.min(s.theme_ribbon_resizing_max_height || 0xFFFF, h);

			// Resize iframe and container
			DOM.setStyle(e, 'height', '');
			DOM.setStyle(ifr, 'height', h);
            
            
			if (s.theme_ribbon_resize_horizontal) {
				DOM.setStyle(e, 'width', '');
				DOM.setStyle(ifr, 'width', w);

				// Make sure that the size is never smaller than the over all ui
				if (w < e.clientWidth) {
					w = e.clientWidth;
					DOM.setStyle(ifr, 'width', e.clientWidth);
				}
			}

			// Store away the size
			if (store && s.theme_ribbon_resizing_use_cookie) {
				Cookie.setHash("TinyMCE_" + ed.id + "_size", {
					cw : w,
					ch : h
				});
			}
		},

		destroy : function() {
			var id = this.editor.id;

			Event.clear(id + '_resize');
			Event.clear(id + '_path_row');
			Event.clear(id + '_external_close');
		},

		// Internal functions

		_simpleLayout : function(s, tb, o, p) {
			var t = this, ed = t.editor, lo = s.theme_ribbon_toolbar_location, sl = s.theme_ribbon_statusbar_location, n, ic, etb, c;

			if (s.readonly) {
				n = DOM.add(tb, 'tr');
				n = ic = DOM.add(n, 'td', {'class' : 'mceIframeContainer'});
				return ic;
			}
            
            // Ribbon is always at top
			t._addToolbars(tb, o);

			// Create iframe container
			if (!s.theme_ribbon_toolbar_container) {
				n = DOM.add(tb, 'tr');
				n = ic = DOM.add(n, 'td', {'class' : 'mceIframeContainer'});
			}


            // status always at the bottom
			t._addStatusBar(tb, o);

			return ic;
		},

        
        /**
        * Auto save contents of CodeMirror to TinyMCE editor at an interval of 2 seconds
        * 
        * This makes sure the contents is set to tiny when the form / page is submitted without switching back to TinyMCE back
        * Contents is set to Tiny on tabswitch too    
        * Only executed with ribbon_fancy_editor Param in Tiny config  
        * 
        */
        _autoSaveCodeMirror : function(){
            var t = this;
            t._disableAutoSaveCodeMirror();
            t._autoSaveCodeMirrorInterval = setInterval(function(){t._saveCodeMirror()}, 2000);
        },
        
        _disableAutoSaveCodeMirror : function(){
            var t = this; 
            clearInterval(t._autoSaveCodeMirrorInterval);
        },
        
        _saveCodeMirror : function(){
            var t = this;
            if (t.codeMirror._isLoaded){
                // make sure it's loaded completely
                t.editor.setContent(t.codeMirror.getCode());  
            } 
        },
        
        
        /**
        *   Private: init CodeMirror
        * 
        *   Set Param theme_ribbon_fancy_source to false to disable CodeMirror editor
        */
        _initCodeMirror : function(size){
            
            var t = this;
            
            //console.log(typeof(CodeMirror));
            if (typeof(CodeMirror) == 'undefined'){
                // loop this function until the source is loaded
                setTimeout(function(){t._initCodeMirror()}, 100);
            } else {
                if (!this.codeMirrorContainer){
                    t.codeMirror = window.CodeMirror.fromTextArea(t.editor.id + '_sourceEditor', {
                        
                        parserfile: "parsexml.js",
                        stylesheet: t.editor.baseURI.toAbsolute(t.url + "/codemirror/css/xmlcolors.css"),
                        path: t.editor.baseURI.toAbsolute(t.url + "/codemirror/js/"),
                        continuousScanning: 500,
                        lineNumbers: true,
                        reindentOnLoad : true,
                        onLoad : function(){
                            // set a flag to indicate it's fully loaded
                            t.codeMirror._isLoaded = true;
                        },
                        // not really needed since tabbutton is not rendered anyway
                        readOnly : t.editor.settings.readonly
                    });
                    // cache the container dom node
                    this.codeMirrorContainer = DOM.select('#' + t.editor.id + '_tbl div.CodeMirror-wrapping')[0];    
                } else {
                     // already inited. Just set the contents of the editor
                     t.codeMirror.setCode(t.sourceEditor.value);
                     // give it some time to load
                    setTimeout(function(){
                        if (t.codeMirror._isLoaded){
                            try{
                                t.codeMirror.focus(); 
                                t.codeMirror.reindent();
                    
                                
                            } catch(e){};
                        }
                    }, 100);
                }
                
                // resize the code editor to the wysiwyg editor
                if (size){
                    var iframe = DOM.select('#' + t.editor.id + '_tbl div.CodeMirror-wrapping iframe')[0];
                    // size - width of the linenumber divs
                    iframe.style.width = (size.w - 35) + 'px';
                    iframe.parentNode.style.width = (size.w - 35) + 'px'; 
                    
                    iframe.style.height = size.h + 'px';
                    iframe.parentNode.style.height = size.h + 'px';
                    
                }
                // showtime
                DOM.removeClass(this.codeMirrorContainer, 'hidden'); 
            }
            
        },          
        
                            
        
        /**
        *   Toggle the editor to source editing or wysiwyg mode
        * 
        *   @param showSource (bool) 
        */
        _toggleSource : function(showSource){
            
            var t = this;
                        
            if (!t.sourceEditor  && showSource){
                t.sourceContainer = DOM.select('#' + t.editor.id + '_tbl td.mceIframeContainer')[0]; 
                t.wysiwygEditor = t.sourceContainer.getElementsByTagName('iframe')[0];
                t.sourceEditor = DOM.add(t.sourceContainer, 'textarea', {id : t.editor.id + '_sourceEditor', 'class' : 'ribbon_source_editor hidden'});
            }
            
            if (showSource){
                
                // resize it to the size of the iframe                
                var size = DOM.getSize(this.wysiwygEditor);
                this.sourceEditor.style.width = (size.w - 5) + 'px';
                this.sourceEditor.style.height = (size.h - 5) + 'px';
                
                DOM.removeClass(this.sourceEditor, 'hidden');
                DOM.addClass(this.wysiwygEditor, 'hidden');
                // format source code in blocks
                var contents = this.editor.getContent();
            
                contents = contents.split('<p').join('\n<p');
                contents = contents.split('<ul').join('\n<ul');
                contents = contents.split('<ol').join('\n<ol');
                contents = contents.split('<h').join('\n<h');
                contents = contents.split('<table').join('\n<table');
                contents = contents.split('<div').join('\n<div');
                contents = contents.split('<embed').join('\n<embed');
                contents = contents.split('<object').join('\n<object');
                contents = contents.split('</object').join('\n</object');
                // trim html
                contents = contents.replace(/^\s+/,'');
                contents = contents.replace(/\s+$/,'');
                
                this.sourceEditor.value = contents;
                var fancy_source = !(t.editor.getParam('theme_ribbon_fancy_source') === false);
                
                if (fancy_source && !this.codeMirrorScript){
                    // lazy load CodeMirror script
                    DOM.add(this.sourceContainer, 'script', {src : t.editor.baseURI.toAbsolute(t.url + "/codemirror/js/codemirror.js") });
                    this.codeMirrorScript = true;
                }
                
                // close any open binded tabs.
                var i = t.ribbonBindElements.length;
                while(i--){
                    t._closeTab(t.ribbonBindElements[i].node);
                }
                
                
                if (fancy_source){
                    t._initCodeMirror(size);
                    t._autoSaveCodeMirror();
                }
                
                
                try{
                    // this fixes a firefox bug: disappearing caret
                    // try catch for IE. It sometimes throws an error
                    this.sourceEditor.focus();
                } catch(e){};
                
            } else {
                
                
                if (DOM.hasClass(this.wysiwygEditor, 'hidden')){
                    
                    if (this.codeMirrorContainer){
                        this.sourceEditor.value = t.codeMirror.getCode();
                        t._disableAutoSaveCodeMirror();
                    }
                    
                    DOM.removeClass(this.wysiwygEditor, 'hidden');
                    //this.editor.setContent(this.sourceEditor.value, {format : 'raw'}); 
                    this.editor.setContent(this.sourceEditor.value); 
                    this.editor.focus();
                }
                
                if (this.codeMirrorContainer){
                    DOM.addClass(this.codeMirrorContainer, 'hidden'); 
                }
                
                DOM.addClass(this.sourceEditor, 'hidden');
                
            }
            
        },
        
        _fireEvent : function(element,event){
            if (document.createEventObject){
                // dispatch for IE
                var evt = document.createEventObject();
                return element.fireEvent('on'+event,evt)
            } else{
                // dispatch for firefox + others
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent(event, true, true ); // event type,bubbling,cancelable
                return !element.dispatchEvent(evt);
            }
        },
        
        /**
        *   Close a tab
        * 
        *   This code should be as efficient as possible. It gets executed on node change which happens a lot!
        *
        *   @param name nodename (e.d. img)
        */
        _closeTab : function(name){
            
            var t = this;

            if (t.bindedTabs && t.bindedTabs[name]){
                DOM.addClass(t.bindedTabs[name]['li'], 'hidden');
                if (!DOM.hasClass(t.bindedTabs[name]['div'], 'hidden')){
                    if (this.currentTab){   
                        this._fireEvent(this.currentTab, 'click');            
                    } else {

                        // open first tab
                        this._fireEvent(DOM.select('#' + t.editor.editorId + '_tbl ul.ribbon_tab_btn li')[0], 'click'); 
                    }
 
                }
                
                DOM.removeClass(t.bindedTabs[name]['li'], 'active'); 
                
            }
         
        },
        
        /**
        *   Open a tab
        *   This code should be as efficient as possible. It gets executed on node change which happens a lot!
        */
        _openTab : function(name, bSwitchTo){
            
            var t = this;
            
            // previous opened tab
            if (!t.bindedTabs[name]){
                this.currentTab  = DOM.select('#' + t.editor.editorId + '_tbl ul.ribbon_tab_btn li.active')[0];
            }
            
            if (t.bindedTabs[name]){
                DOM.removeClass(t.bindedTabs[name]['li'], 'hidden');
                if (bSwitchTo){
                    t._fireEvent(t.bindedTabs[name]['li'], 'click');      
                }
            }
            
        },
        
        /**
        * Unordered list with tab buttons in ribbon
        * 
        * @param c parant DOM node
        * @param title Title of Ribbon tab
        * @param bind bind to DOM element name (e.g. img)
        */
        _createTabButton : function(c, title, bind, source){
            
            var t = this;
            if (!t.tabButtons){
                t.tabButtons = {};
            }
            
            if (!t.ribbonBindElements){
                t.ribbonBindElements = [];
            }
            
            if (!t.tabButtons.ul){
                t.tabButtons.ul = DOM.add(c, 'ul', {'class' : 'ribbon_tab_btn'});
                Event.add(t.tabButtons.ul, 'click', function(e) {
                   if (DOM.getParent(e.target, 'li')){ 
                       var li = t.tabButtons.ul.getElementsByTagName('li');
                       var i = li.length;
                       
                       while(i--){
                           DOM.removeClass(li[i], 'active');
                       }
                   }
                   
                   // switch to this tab
                   var container = DOM.getParent(e.target, 'table');
                   var tabs = container.getElementsByTagName('div');
                   var i = tabs.length;
                   
                   while(i--){
                        if (DOM.hasClass(tabs[i], 'ribbon_tab_div')){
                            // show the current clicked tab
                            var li = DOM.getParent(e.target, 'li');
                            if (!li){
                                // no tab clicked
                                break;
                            }
                            
                            // hide the ribbon tab div
                            DOM.addClass(tabs[i], 'hidden');
                            
                            if (tabs[i].getAttribute('rel') == li.getAttribute('rel')){
                                //console.log('open ' + li.title);
                                DOM.removeClass(tabs[i], 'hidden');
                                
                                // make this li active
                                DOM.addClass(li, 'active');
                                
                                
                                
                            }
                            
                            
                        } 
                           
                   }
                   
                   if (li){
                        t._toggleSource(DOM.hasClass(li, 'source'));
                   }
                   
                   if (!DOM.hasClass(li, 'source')){

                        if (t._bookmark){
                            try {
                            t.editor.selection.moveToBookmark(t._bookmark);
                            } catch(e){};
                        }
                        t.editor.focus(); 

                    }
                   
                
                   
                });
            }
            var bindTo = bind || false;
            
            
            
            /**
            * @todo translate title   
            */              
            var params = {'rel': title, 'title' : title, 'class' : title};
            if (bindTo){
                t.ribbonBindElements.push({tab : title, node : bindTo});
                params['class'] += ' hidden binded';
            }
            if (source){
                params['class'] += ' source';
            }
            if (!t.tabButtons.active){
                params['class'] += ' active';
                t.tabButtons.active = true;
            }
            t.tabButtons.ul.onselectstart = function () { return false; } 
            t.tabButtons.ul.onmousedown = function () { return false; }
            
            var li_button = DOM.add(t.tabButtons.ul, 'li', params, '<span>' + title + '</span>');
            li_button.onmousedown = function(){
                if (t.editor.selection.isCollapsed()){
                    t._bookmark = false;
                } else {
                    t._bookmark = t.editor.selection.getBookmark();
                }
            }
            return li_button;
             
            
        },
        
        /**
        * Div container for groups and buttons in Ribbon
        * 
        * @param c parent DOM node
        * @param title Title of Ribbon tab
        * @param bind Bind this tab to dom element (e.g. img)
        * @param source (bool) edit source 
        */
        _createTabDiv : function(c, title, bind, source){
            
            var t = this;
            
            if (!t.tabDiv){
                t.tabDiv = {};
            }
            // create the tab buttons (<li>)  
            var li = this._createTabButton(c, title, bind, source);
            var params = {'rel' : title, 'class' : 'ribbon_tab_div hidden'};
            if (!t.tabDiv.first){
                // first tab is not hidden
                params['class'] = 'ribbon_tab_div';
                t.tabDiv.first = true;    
            }
            
            var div =  DOM.add(c, 'div', params); 
            
            var bindTo = bind || false;
            if (bindTo){
                if (!t.bindedTabs){
                    t.bindedTabs = {};
                }
                // build object with binded tabs to use on nodeChange
                t.bindedTabs[bind] = {li : li, div : div};
            }
            
            
            return div;
            
               
        },

		_addToolbars : function(c, o) {
			var t = this, i, tb, ed = t.editor, s = t.settings, v, cf = ed.controlManager, di, n, h = [], a;

            var title, bind, items, group, div, btn, j, k, set, tr, td, big, rows;
            
			a = s.theme_ribbon_toolbar_align.toLowerCase();
			a = 'mce' + t._ufirst(a);

			n = DOM.add(DOM.add(c, 'tr'), 'td', {'class' : 'mceToolbar ' + a});

			if (!ed.getParam('accessibility_focus'))
				h.push(DOM.createHTML('a', {href : '#', onfocus : 'tinyMCE.get(\'' + ed.id + '\').focus();'}, '<!-- IE -->'));

			h.push(DOM.createHTML('a', {href : '#', accesskey : 'q', title : ed.getLang("ribbon.toolbar_focus")}, '<!-- IE -->'));

            
            // apend a table row and a cell
            tr = DOM.add(c, 'tr');
            
            
            // hide the ribbon and show it on post render
            // this speeds up the rendering of the browser 
            td = DOM.add(tr, 'td', {'class' : 'ribbon', style : 'visibility:hidden'});
            

            rows = 0;
            
            DOM.add(td, 'div', {}, '<span title="' + ed.getLang("ribbon.undo_desc") + '" onclick="tinymce.editors[\'' + ed.editorId + '\'].undoManager.undo()" class="undo">Undo</span> <span title="' + ed.getLang("ribbon.redo_desc") + '" onclick="tinymce.editors[\'' + ed.editorId + '\'].undoManager.redo()" class="undo redo">Redo</span>');
            
            // create ribbon tabs
            for (i=1; (v = s['theme_ribbon_tab' + i]); i++) {
                // title
                title = v['title'] || false; 
                bind = v['bind']; 
                items = v['items'];
                
                
                if (title){
                    // create tab container and tab buttons
                    div = t._createTabDiv(td, ed.getLang('ribbon.' + title, title), bind, (v['source']  && v['source'] == true));
                    
                    // create buttons in groups
                    for(j=0; (items && items[j]); j++){
                        group = DOM.add(div, 'div', {'class' : 'ribbon_group'});
                        set = ['<table><tr>'];
                        for(k=0; (items[j][k]); k++){
                            if (items[j][k] == '|'){
                                //console.log('start a new row');
                                set.push('</tr><tr>');
                                rows++;
                            } else {
                                if (items[j][k].indexOf(',') == -1){
                                    
                                    
                                    btn = this.createControl(items[j][k], cf);
                                    if (btn){
                                        set.push('<td>' + btn.renderHTML() + '</td>');                      
                                    }
                                } else {
                                    // set of buttons within group
                                    // create a table with cells
                                    set.push('<td><table class="ribbon_group_set"><tr>');
                                    
                                    each(explode(items[j][k]), function(n) {
                                        btn = t.createControl(n, cf);
                                        if (btn){
                                            set.push('<td>' + btn.renderHTML() + '</td>');
                                        }    
                                    });
                                    set.push('</tr></table></td>');     
                                }
                            }
                        }
                        set.push('</tr></table>');
                        DOM.setHTML(group, set.join('')); 
                    }
                    
                }
            }

              
			h.push(DOM.createHTML('a', {href : '#', accesskey : 'z', title : ed.getLang("ribbon.toolbar_focus"), onfocus : 'tinyMCE.getInstanceById(\'' + ed.id + '\').focus();'}, '<!-- IE -->'));
			DOM.setHTML(n, h.join(''));
            
            

            /**
            *   Set the headings and paragraphs of the block format buttons
            */
            ed.onPostRender.add(function() {
                  
                if (rows == 0){
                    // just a single row of buttons. Adjust the height of the ribbon to a single row
                    DOM.addClass(DOM.select('#' + ed.editorId + '_tbl div.ribbon_tab_div'), 'ribbon_tab_small');
                }
                
                
                var i, btn, icon, ribbon;
                
                // show the ribbon. 
                ribbon = DOM.select('#' + t.editor.editorId + '_tbl td.ribbon');
                ribbon[0].style.visibility = 'visible';
                
                
                
                // format blocks
                btn = t._getButton('paragraph');         
                if (btn){
                    icon = btn.getElementsByTagName('span')[0];
                    icon.innerHTML = '<div class="heading_container"><p>AaBbCc</p></div>';
                }
                
                for(i=1; i<= 6; i++){
                    btn = t._getButton('heading' + i);         
                    if (btn){
                        icon = btn.getElementsByTagName('span')[0];
                        icon.innerHTML = '<div class="heading_container"><h' + i + '>AaBbCc</h' + i + '></div>';
                    }
                }
                
                
                
                
            });
            
            
		},
        
        
		_addStatusBar : function(tb, o) {
			var n, t = this, ed = t.editor, s = t.settings, r, mf, me, td;

			n = DOM.add(tb, 'tr');
			n = td = DOM.add(n, 'td', {'class' : 'mceStatusbar'});
			n = DOM.add(n, 'div', {id : ed.id + '_path_row'}, s.theme_ribbon_path ? ed.translate('ribbon.path') + ': ' : '&#160;');
			DOM.add(n, 'a', {href : '#', accesskey : 'x'});

			if (s.theme_ribbon_resizing) {
				DOM.add(td, 'a', {id : ed.id + '_resize', href : 'javascript:;', onclick : "return false;", 'class' : 'mceResize'});

				if (s.theme_ribbon_resizing_use_cookie) {
					ed.onPostRender.add(function() {
						var o = Cookie.getHash("TinyMCE_" + ed.id + "_size"), c = DOM.get(ed.id + '_tbl');

						if (!o)
							return;

						t.resizeTo(o.cw, o.ch);
					});
				}

				ed.onPostRender.add(function() {
					Event.add(ed.id + '_resize', 'click', function(e) {
						e.preventDefault();
					});

					Event.add(ed.id + '_resize', 'mousedown', function(e) {
						var mouseMoveHandler1, mouseMoveHandler2,
							mouseUpHandler1, mouseUpHandler2,
							startX, startY, startWidth, startHeight, width, height, ifrElm;

						function resizeOnMove(e) {
							e.preventDefault();

							width = startWidth + (e.screenX - startX);
							height = startHeight + (e.screenY - startY);

							t.resizeTo(width, height);
						};

						function endResize(e) {
							// Stop listening
							Event.remove(DOM.doc, 'mousemove', mouseMoveHandler1);
							Event.remove(ed.getDoc(), 'mousemove', mouseMoveHandler2);
							Event.remove(DOM.doc, 'mouseup', mouseUpHandler1);
							Event.remove(ed.getDoc(), 'mouseup', mouseUpHandler2);

							width = startWidth + (e.screenX - startX);
							height = startHeight + (e.screenY - startY);
							t.resizeTo(width, height, true);
						};

						e.preventDefault();

						// Get the current rect size
						startX = e.screenX;
						startY = e.screenY;
						ifrElm = DOM.get(t.editor.id + '_ifr');
						startWidth = width = ifrElm.clientWidth;
						startHeight = height = ifrElm.clientHeight;

						// Register envent handlers
						mouseMoveHandler1 = Event.add(DOM.doc, 'mousemove', resizeOnMove);
						mouseMoveHandler2 = Event.add(ed.getDoc(), 'mousemove', resizeOnMove);
						mouseUpHandler1 = Event.add(DOM.doc, 'mouseup', endResize);
						mouseUpHandler2 = Event.add(ed.getDoc(), 'mouseup', endResize);
					});
				});
			}

			o.deltaHeight -= 21;
			n = tb = null;
		},

		_nodeChanged : function(ed, cm, n, co, ob) {
			var t = this, p, de = 0, v, c, s = t.settings, cl, fz, fn, formatNames, matches, bindElements, i, bindClasses, bindContainer;

			tinymce.each(t.stateControls, function(c) {
				cm.setActive(c, ed.queryCommandState(t.controls[c][1]));
			});

			function getParent(name) {
				var i, parents = ob.parents, func = name;

				if (typeof(name) == 'string') {
					func = function(node) {
						return node.nodeName == name;
					};
				}

				for (i = 0; i < parents.length; i++) {
					if (func(parents[i]))
						return parents[i];
				}
			};

			cm.setActive('visualaid', ed.hasVisual);
			cm.setDisabled('undo', !ed.undoManager.hasUndo() && !ed.typing);
			cm.setDisabled('redo', !ed.undoManager.hasRedo());
			cm.setDisabled('outdent', !ed.queryCommandState('Outdent'));
            
            /*
            Block level formatting
            */
            cm.setActive('paragraph', getParent('P'));
            cm.setActive('heading1', getParent('H1'));
            cm.setActive('heading2', getParent('H2'));
            cm.setActive('heading3', getParent('H3'));
            cm.setActive('heading4', getParent('H4'));
            cm.setActive('heading5', getParent('H5'));
            cm.setActive('heading6', getParent('H6'));
            
            
            bindElements = t.ribbonBindElements;
            i = 0;
            if (bindElements){
                i = bindElements.length;
            }
            
            // activate tab for selected node (ribbon -> bind)
            while(i--){
                
                if (bindElements[i].node.indexOf('.') == -1){
                    // just a tagname, no classes specified
                    if (getParent(bindElements[i].node.toUpperCase())){
                        t._openTab(bindElements[i].node, (getParent(bindElements[i].node.toUpperCase()) == n));
                    } else {
                        t._closeTab(bindElements[i].node);
                    }
                } else {
                    // a tagname with classes. Only bind it to a ribbon tab if it has the defined class(es)
                    bindClasses = bindElements[i].node.split('.');
                    if (bindContainer = getParent(bindClasses[0].toUpperCase())){ 
                        if (ed.dom.select('.' + bindClasses.slice(1).join('.'), bindContainer.parentNode).length > 0){
                            t._openTab(bindElements[i].node, (getParent(bindClasses[0].toUpperCase()) == n));      
                        } else {
                            t._closeTab(bindElements[i].node);
                        }
                        
                    } else {
                        t._closeTab(bindElements[i].node);    
                    }
                    
                    
                }
            }
            
            

			p = getParent('A');
                        
			if (c = cm.get('link')) {
                
				if (!p || !p.name) {
					//c.setDisabled(!p && co);
					c.setActive(!!p);
				}
			}

			if (c = cm.get('unlink')) {
                //c.setDisabled(!p && co);
				c.setDisabled(!p);
				c.setActive(!!p && !p.name);
			}

			if (c = cm.get('anchor')) {
				c.setActive(!!p && p.name);
			}

			p = getParent('IMG');
			if (c = cm.get('image'))
				c.setActive(!!p && n.className.indexOf('mceItem') == -1);

			if (c = cm.get('styleselect')) {
				t._importClasses();

				formatNames = [];
				each(c.items, function(item) {
					formatNames.push(item.value);
				});

				matches = ed.formatter.matchAll(formatNames);
				c.select(matches[0]);
			}

			if (c = cm.get('formatselect')) {
				p = getParent(DOM.isBlock);

				if (p)
					c.select(p.nodeName.toLowerCase());
			}

			// Find out current fontSize, fontFamily and fontClass
			getParent(function(n) {
				if (n.nodeName === 'SPAN') {
					if (!cl && n.className)
						cl = n.className;

					if (!fz && n.style.fontSize)
						fz = n.style.fontSize;

					if (!fn && n.style.fontFamily)
						fn = n.style.fontFamily.replace(/[\"\']+/g, '').replace(/^([^,]+).*/, '$1').toLowerCase();
				}

				return false;
			});

			if (c = cm.get('fontselect')) {
				c.select(function(v) {
					return v.replace(/^([^,]+).*/, '$1').toLowerCase() == fn;
				});
			}

			// Select font size
			if (c = cm.get('fontsizeselect')) {
				// Use computed style
				if (s.theme_ribbon_runtime_fontsize && !fz && !cl)
					fz = ed.dom.getStyle(n, 'fontSize', true);

				c.select(function(v) {
					if (v.fontSize && v.fontSize === fz)
						return true;

					if (v['class'] && v['class'] === cl)
						return true;
				});
			}

			if (s.theme_ribbon_path && s.theme_ribbon_statusbar_location) {
				p = DOM.get(ed.id + '_path') || DOM.add(ed.id + '_path_row', 'span', {id : ed.id + '_path'});
				DOM.setHTML(p, '');

				getParent(function(n) {
					var na = n.nodeName.toLowerCase(), u, pi, ti = '';

					/*if (n.getAttribute('_mce_bogus'))
						return;
*/
					// Ignore non element and hidden elements
					if (n.nodeType != 1 || n.nodeName === 'BR' || (DOM.hasClass(n, 'mceItemHidden') || DOM.hasClass(n, 'mceItemRemoved')))
						return;

					// Fake name
					if (v = DOM.getAttrib(n, 'mce_name'))
						na = v;

					// Handle prefix
					if (tinymce.isIE && n.scopeName !== 'HTML')
						na = n.scopeName + ':' + na;

					// Remove internal prefix
					na = na.replace(/mce\:/g, '');

					// Handle node name
					switch (na) {
						case 'b':
							na = 'strong';
							break;

						case 'i':
							na = 'em';
							break;

						case 'img':
							if (v = DOM.getAttrib(n, 'src'))
								ti += 'src: ' + v + ' ';

							break;

						case 'a':
							if (v = DOM.getAttrib(n, 'name')) {
								ti += 'name: ' + v + ' ';
								na += '#' + v;
							}

							if (v = DOM.getAttrib(n, 'href'))
								ti += 'href: ' + v + ' ';

							break;

						case 'font':
							if (v = DOM.getAttrib(n, 'face'))
								ti += 'font: ' + v + ' ';

							if (v = DOM.getAttrib(n, 'size'))
								ti += 'size: ' + v + ' ';

							if (v = DOM.getAttrib(n, 'color'))
								ti += 'color: ' + v + ' ';

							break;

						case 'span':
							if (v = DOM.getAttrib(n, 'style'))
								ti += 'style: ' + v + ' ';

							break;
					}

					if (v = DOM.getAttrib(n, 'id'))
						ti += 'id: ' + v + ' ';

					if (v = n.className) {
						v = v.replace(/\b\s*(webkit|mce|Apple-)\w+\s*\b/g, '')

						if (v) {
							ti += 'class: ' + v + ' ';

							if (DOM.isBlock(n) || na == 'img' || na == 'span')
								na += '.' + v;
						}
					}

					na = na.replace(/(html:)/g, '');
					na = {name : na, node : n, title : ti};
					t.onResolveName.dispatch(t, na);
					ti = na.title;
					na = na.name;

					//u = "javascript:tinymce.EditorManager.get('" + ed.id + "').theme._sel('" + (de++) + "');";
					pi = DOM.create('a', {'href' : "javascript:;", onmousedown : "return false;", title : ti, 'class' : 'mcePath_' + (de++)}, na);

					if (p && p.hasChildNodes()) {
						p.insertBefore(DOM.doc.createTextNode(' \u00bb '), p.firstChild);
						p.insertBefore(pi, p.firstChild);
					} else if (p){
						p.appendChild(pi);
                    } 
				}, ed.getBody());
			}
		},

		// Commands gets called by execCommand

		_sel : function(v) {
			this.editor.execCommand('mceSelectNodeDepth', false, v);
		},

		_mceInsertAnchor : function(ui, v) {
			var ed = this.editor;

			ed.windowManager.open({
				url : this.url + '/anchor.htm',
				width : 310 + parseInt(ed.getLang('ribbon.anchor_delta_width', 0)),
				height : 100 + parseInt(ed.getLang('ribbon.anchor_delta_height', 0)),
				inline : true
			}, {
				theme_url : this.url
			});
		},

		_mceCharMap : function() {
			var ed = this.editor;

			ed.windowManager.open({
				url : this.url + '/charmap.htm',
				width : 550 + parseInt(ed.getLang('ribbon.charmap_delta_width', 0)),
				height : 270 + parseInt(ed.getLang('ribbon.charmap_delta_height', 0)),
				inline : true
			}, {
				theme_url : this.url
			});
		},

		_mceHelp : function() {
			var ed = this.editor;

			ed.windowManager.open({
				url : this.url + '/about.htm',
				width : 480,
				height : 380,
				inline : true
			}, {
				theme_url : this.url
			});
		},

		_mceColorPicker : function(u, v) {
			var ed = this.editor;

			v = v || {};

			ed.windowManager.open({
				url : this.url + '/color_picker.htm',
				width : 375 + parseInt(ed.getLang('ribbon.colorpicker_delta_width', 0)),
				height : 250 + parseInt(ed.getLang('ribbon.colorpicker_delta_height', 0)),
				close_previous : false,
				inline : true
			}, {
				input_color : v.color,
				func : v.func,
				theme_url : this.url
			});
		},

		_mceCodeEditor : function(ui, val) {
			var ed = this.editor;

			ed.windowManager.open({
				url : this.url + '/source_editor.htm',
				width : parseInt(ed.getParam("theme_ribbon_source_editor_width", 720)),
				height : parseInt(ed.getParam("theme_ribbon_source_editor_height", 580)),
				inline : true,
				resizable : true,
				maximizable : true
			}, {
				theme_url : this.url
			});
		},

		_mceImage : function(ui, val) {
			var ed = this.editor;

			// Internal image object like a flash placeholder
			if (ed.dom.getAttrib(ed.selection.getNode(), 'class').indexOf('mceItem') != -1)
				return;

			ed.windowManager.open({
				url : this.url + '/image.htm',
				width : 355 + parseInt(ed.getLang('ribbon.image_delta_width', 0)),
				height : 175 + parseInt(ed.getLang('ribbon.image_delta_height', 0)),
				inline : true
			}, {
				theme_url : this.url
			});
		},

		_mceLink : function(ui, val) {
			var ed = this.editor;

			ed.windowManager.open({
				url : this.url + '/link.htm',
				width : 510 + parseInt(ed.getLang('ribbon.link_delta_width', 0)),
				height : 155 + parseInt(ed.getLang('ribbon.link_delta_height', 0)),
				inline : true
			}, {
				theme_url : this.url
			});
		},
        
        
        _mceLinkFollow : function(ui, val) {
            var ed = this.editor;
            var el = ed.selection.getNode(); 
            if (el.href){
                window.open(el.href);
            }
            
        },
        

		_mceNewDocument : function() {
			var ed = this.editor;

			ed.windowManager.confirm('ribbon.newdocument', function(s) {
				if (s)
					ed.execCommand('mceSetContent', false, '');
			});
		},

		_mceForeColor : function() {
			var t = this;

			this._mceColorPicker(0, {
				color: t.fgColor,
				func : function(co) {
					t.fgColor = co;
					t.editor.execCommand('ForeColor', false, co);
				}
			});
		},

		_mceBackColor : function() {
			var t = this;

			this._mceColorPicker(0, {
				color: t.bgColor,
				func : function(co) {
					t.bgColor = co;
					t.editor.execCommand('HiliteColor', false, co);
				}
			});
		},

		_ufirst : function(s) {
			return s.substring(0, 1).toUpperCase() + s.substring(1);
		}
	});

	tinymce.ThemeManager.add('ribbon', tinymce.themes.RibbonTheme);
}(tinymce));
