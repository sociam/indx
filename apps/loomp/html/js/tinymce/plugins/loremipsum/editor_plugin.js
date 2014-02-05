/**
 * Lorem Ipsum plug-in for TinyMCE version 3.x
 * -------------------------------------------
 * $Id: editor_plugin_src.js 10 2009-04-30 23:20:50Z scholzj $
 *
 * @author     JAkub Scholz
 * @version    $Rev: 10 $
 * @package    LoremIpsum
 * @link       http://www.assembla.com/spaces/lorem-ipsum
 */

(function() {
    // Load plugin specific language pack
    tinymce.PluginManager.requireLangPack('loremipsum');

    tinymce.create('tinymce.plugins.LoremIpsum', {

        init : function(ed, url) {
            ed.addCommand('mceLoremIpsum', function() {

                if (!this.iCounter){
                    this.iCounter = 0;
                }

                var aLipsum = [  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut congue, tortor non lacinia posuere, velit orci tempor nisl, in adipiscing leo nunc vel eros. Integer scelerisque, dolor ac gravida interdum, leo tortor rutrum eros, sit amet dignissim nulla urna sed ipsum. Nullam dolor urna, ultricies eget, tincidunt id, egestas sed, lacus. Cras commodo condimentum turpis. Praesent condimentum posuere justo. Phasellus eget nunc eu tellus dignissim vulputate. Nam arcu velit, condimentum ut, placerat id, hendrerit in, risus. Nunc vitae mi at massa fermentum consequat. Aliquam sit amet erat sed tellus posuere viverra. Praesent porta. Integer tortor erat, lobortis ac, venenatis quis, aliquam eu, urna. Sed erat. Nullam massa odio, iaculis et, adipiscing tempus, sollicitudin in, velit.',
                                'Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. In hac habitasse platea dictumst. Phasellus mi lorem, aliquet a, condimentum ut, porta a, diam. Proin quam lectus, blandit vitae, commodo in, vulputate a, turpis. Quisque id nisl sed metus tincidunt hendrerit. Cras viverra tellus facilisis tellus. Proin ac tortor vitae ante sollicitudin cursus. Vestibulum nibh nisi, convallis quis, tempor sed, vehicula id, risus. Nulla quis sapien ut turpis venenatis tristique. Curabitur at elit ac nisl imperdiet venenatis. Aliquam erat volutpat. Curabitur in leo in enim volutpat tristique. Cras vitae dolor sit amet odio rhoncus pellentesque. Nunc lacinia. Curabitur id massa. Fusce in magna. Nam sed tortor. Curabitur suscipit, dui non ultrices vestibulum, ligula odio egestas libero, et aliquam enim lectus et felis. Cras fringilla mi eget lectus.',
                                'Nullam eget quam quis nibh auctor convallis. Integer velit lorem, ultricies vel, imperdiet vel, tincidunt et, nibh. Donec non tellus. Nullam malesuada sagittis nunc. Curabitur sem. Vivamus aliquet, nulla eget luctus dapibus, felis quam malesuada risus, at feugiat erat arcu quis lorem. Integer adipiscing ipsum a purus semper imperdiet. Nam consectetur nunc sed arcu. Aenean nec risus. Morbi at neque sed ante congue tempus. Quisque eleifend erat ac velit. Donec placerat quam nec diam. ',
                                'Cras imperdiet, turpis id adipiscing rutrum, nisl erat semper odio, vitae molestie massa magna vel dui. Nullam purus. Mauris at felis vitae nunc commodo mattis. In ornare. Vestibulum accumsan. Ut condimentum sodales enim. Phasellus tristique metus et augue. Praesent fringilla. Sed ultricies dolor at sem. Proin varius elementum nisi. Aenean varius commodo lectus. Phasellus a ligula bibendum quam gravida bibendum. Donec rhoncus. Duis viverra. Cras dictum, tellus nec rhoncus iaculis, nulla diam posuere magna, sit amet ultricies mauris mauris et lorem. Aenean in dolor. Integer arcu nisi, eleifend eget, blandit sit amet, egestas et, lectus. ',
                                'Sed vulputate metus eu quam. Etiam lacinia diam sed nulla. Maecenas sit amet est. Mauris nec lacus ac sem posuere consectetur. Donec eget nisl sit amet mauris hendrerit volutpat. Duis porttitor feugiat massa. Donec aliquet feugiat tellus. Donec in massa. Sed facilisis mattis nibh. Aenean pharetra turpis rutrum ante. Ut et nunc. ',
                                'Curabitur consectetur lacus non diam. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus fringilla magna sed eros. Phasellus a ipsum. Maecenas posuere nibh vel ipsum. Aliquam erat volutpat. Pellentesque malesuada. Maecenas purus quam, fermentum a, pulvinar vitae, faucibus in, urna. Praesent facilisis commodo lorem. In ac libero. Donec eleifend egestas tellus. In ut dolor luctus nisl gravida viverra. Sed nunc. Duis sollicitudin augue. Maecenas ornare mauris sed dui. Aenean vel nisl eu nisi viverra lobortis. Nam adipiscing tempus libero. Etiam vel ante a urna aliquet mollis. ',
                                'Proin varius suscipit elit. Suspendisse eu mauris non sem semper imperdiet. Aenean sodales. Curabitur hendrerit mattis magna. Maecenas aliquet, mi quis faucibus faucibus, dolor sem adipiscing quam, et euismod nisi erat nec tellus. Phasellus massa ligula, lobortis nec, dignissim at, consequat sit amet, sapien. Suspendisse non libero nec diam pellentesque pellentesque. Nam est. Integer pellentesque massa sed risus. Quisque ut lectus a felis luctus venenatis. Aliquam porta. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis quam diam, porttitor non, laoreet a, luctus id, odio. Nulla dapibus mauris in risus. Ut accumsan ligula vel libero. Donec vitae sapien eu orci tincidunt pretium. Donec quis mauris interdum risus vestibulum sollicitudin. Maecenas pretium, mauris eu hendrerit facilisis, elit enim placerat elit, ut malesuada turpis sem pretium arcu. Sed sodales mollis urna. ',
                                'Aliquam semper est eu lectus. Nulla aliquet, arcu eu imperdiet sodales, purus urna molestie orci, in dignissim ligula turpis id neque. Praesent dignissim adipiscing sapien. Nam dolor lectus, pharetra ac, venenatis at, sollicitudin et, nulla. Fusce euismod. Sed a dui. Sed mauris ligula, dignissim porttitor, luctus sed, dictum quis, odio. Maecenas pretium tincidunt libero. Integer velit. Donec fermentum egestas nibh. Suspendisse tristique magna vel lacus. In nisl felis, euismod ac, tempus sit amet, malesuada in, felis. Vivamus justo justo, tincidunt a, posuere ut, posuere nec, elit. Aenean tempor tempor sem. Vivamus condimentum eleifend orci. Fusce sollicitudin augue vel urna. Pellentesque eleifend. Cras eleifend urna ultrices felis. ',
                                'Nam elementum. Etiam non ante. Nam purus. Cras convallis ullamcorper libero. Fusce a felis quis libero congue vestibulum. Cras metus mauris, gravida facilisis, faucibus vel, facilisis eget, elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut quis libero nec ante laoreet vehicula. Fusce ultricies lectus porttitor ante commodo venenatis. Duis vel ante sed ante rhoncus tempor. Vivamus justo purus, vehicula id, tincidunt sed, fermentum vitae, erat. Fusce vestibulum purus eget dolor. Integer lorem. Mauris lorem urna, pretium non, elementum posuere, convallis sed, felis. Nulla tristique, nisl vel elementum scelerisque, purus metus aliquam neque, sed lacinia ligula nibh ac metus.'
                             ];

                if (this.iCounter > aLipsum.length - 1){
                   this.iCounter = 0;
                }
            
                // this was hard to write....
                
                var sLipsum = '<p>' + aLipsum[this.iCounter] + '</p>\n <br id="_placeholder">';
                
                //var objBookmark = ed.selection.getBookmark();
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

                ed.dom.setOuterHTML(ed.dom.select('._mce_marker')[0], sLipsum);
                
                
                var aBr = ed.dom.select('br#_placeholder');
                
                ed.selection.select(aBr[0]);
                ed.selection.collapse();
                
                tinymce.each(aBr, function(n){
                    ed.dom.remove(n);
                });         
                
                
                //ed.selection.select();
                //ed.addVisual();
                //ed.selection.moveToBookmark(objBookmark);
                this.iCounter++;
                
                
                
            });

            // Register LoremIpsum button
            ed.addButton('loremipsum', {
                title : 'loremipsum.desc',
                cmd : 'mceLoremIpsum',
                label : 'loremipsum.label',
                image : url + '/img/dummy.png'
            });

        },

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
                longname : 'Lorem Ipsum plugin',
                author : 'Vincent Kleijnendorst - SWIS BV',
                authorurl : 'http://www.swis.nl',
                infourl : 'http://www.swis.nl',
                version : "0.1"
            };
        }
    });

    // Register plugin
    tinymce.PluginManager.add('loremipsum', tinymce.plugins.LoremIpsum);
})();