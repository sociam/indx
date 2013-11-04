
Date.prototype.toShortStringUK = function(){
        var hours = (this.getHours() < 10 ? "0" : "") + this.getHours();
        var minutes = (this.getMinutes() < 10 ? "0" : "") + this.getMinutes();
    return this.getDate() +  "/" +  this.getMonth() + "/" + this.getFullYear() + " at " + hours + ":" + minutes;
};

window.DEBUG=true;
window.LOG = true;

_.mixin({
            capitalize : function(string) {
                return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
            },
            withoutAny:function(src,ofwhat, keyfn) {
                if (keyfn !== undefined) {
                    ofwhat = ofwhat.map(function(x) { return keyfn(x); });
                }
                var _ofwhat = _(ofwhat);
                return src.filter(function(x) {
                                      if (keyfn !== undefined) { x = keyfn(x); }
                                      return !_ofwhat.contains(x);
                                  });
            }
});

window.debug = function() {
    try{
        if (DEBUG) {
            console.log.apply(console,arguments);
        }
    }catch(e) {}
};

window.log = function() {
    try{
        if (LOG) {
            console.log.apply(console,arguments);
        }
    }catch(e) {}
};
window.error = function() {
    try{
        console.error.apply(console,arguments);
    }catch(e) {}
};


util = {
    zip2obj:function(z) {
        var o = {};
        _(z).map(function(x) {  o[x[0]] = x[1];   });
        return o;
    },
    randomlyPick:function(l) {
        return l[Math.floor(l.length*Math.random())];
    },    
    txt2html: function(oldText) {
            var newText = oldText.replace(/</g,'&lt;');
            newText = newText.replace(/>/g,'&gt;');
            newText = newText.replace(/\n/g,'<br>');
            newText = newText.replace(/&lt;(\/?)(b|i|em|strong|sub|sup|u|p|br|ins|del|strike|s)&gt;/ig,
                                      "<$1$2>");
            newText = newText.replace(/((mailto\:|javascript\:|(news|file|(ht|f)tp(s?))\:\/\/)[A-Za-z0-9,\.:_\/~%\-+&#?!=()@\x80-\xB5\xB7\xFF]+)/g,
                                      "<a onclick=\"openLink(event);\" href=\"$1\">$1</a>");
            newText = newText.replace(/<a onclick=\"openLink\(event\);\" href=\"(((http(s?))\:\/\/)?[A-Za-z0-9\._\/~\-:]+\.(?:png|jpg|jpeg|gif|bmp))\">(((http(s?))\:\/\/)?[A-Za-z0-9\._\/~\-:]+\.(?:png|jpg|jpeg|gif|bmp))<\/a>/g,
                                      "<img src=\"$1\" alt=\"$1\"/>");
            newText = newText.replace(/  /g,' &nbsp;');
            newText = newText.replace(/\t/g,' &nbsp;&nbsp;&nbsp&nbsp;');
            
            return newText;
        },
    intRange: function(low,high,skip)  {
	var result = [];
	if (skip === undefined) { skip = 1; }
	for (var i = low; i < high; i += skip) {
	    result.push(i);
	}
	return result;    
    },
    refang: function(oldText) {
        var newText = oldText.replace(/&lt;/g,'<');
        newText = newText.replace(/&gt;/g, '>');
        newText = newText.replace(/<br>/g, '\n');
        newText = newText.replace(/&nbsp;/g, ' ');
        return newText;
    },
    guid: function(len) {
	var alphabet = 'abcdefghijklmnopqrstuvwxyz1234567890';
	if (!len) { len = 12; }
	var s = '';
	for (var i = 0; i < len; i++) {
	    s += alphabet[Math.floor(alphabet.length*Math.random())];
	}
	return s;
    }
};
