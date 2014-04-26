/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */

var countLeadIndents = function(s) {
	var splits = s.split('\t');
	for (var i = 0; i < splits.length; i++) {
		var ss = splits[i].trim();
		if (ss.length > 0) { return i; }
	}
	return undefined;
};

var parseItem = function(s) {
	var si = s.split('\t');
	if (si[0].trim() == 'Form') { return { name: si[1] && si[1].trim(), version:si[2] }; }
	if (si[0].trim() == 'Category') { return { type: 'category', name: si[1] && si[1].trim() }; }
	if (si[0].trim() == 'Group') { return { type: 'group', name: si[1] && si[1].trim() }; }
	if (si[0].trim() == 'Item') { return { type: 'item', valuetype: si[1], name: si[2], values: si[3] && si[3].split(',').map(function(x) { return x.trim(); }) }};
	return undefined;
}

angular.module('datawell')
	.factory('fmlParser', function() {
		var parse = function(text){
			var lines = 
				text.split('\n')
				.filter(function(x) { return x[0] !== '#' && x.length > 0; });

			var tree = [], stack = [tree], lastindent = 0;

			lines.map(function(l) {
				var leading_indents = countLeadIndents(l);
				console.log(leading_indents, " - ", l);
				if (leading_indents < lastindent) {
					stack.pop();					
					console.log('pop! -- ', stack.length);
				} 
				if (leading_indents > lastindent) {
					var meta, last = stack[stack.length-1].slice(-1)[0];
					// pop las tthing as it was the title of this
					if ((last && last.type == 'category') || (last && last.type == 'group')) { 
						// pop up the last one
						meta = stack[stack.length-1].pop();
					}
					var newlevel = [];
					stack[stack.length-1].push(newlevel);
					stack.push(newlevel);
					if (meta !== undefined) { _(newlevel).extend(meta); }
				}
				stack[stack.length-1].push(parseItem(l.trim()));
				lastindent = leading_indents;
			});
			window.tree = tree;
			console.log('parse result >> ', tree);
			return tree;
		};
		return { parse:parse };		
	});