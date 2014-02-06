tinymce.PluginManager.add('loomp', function(editor, url) {
    function showDialog() {
        var selectedNode = editor.selection.getNode();
        window.parent.annotationSelection = selectedNode;
        editor.windowManager.open({
            file: 'spotlight.html',
            width: 900,
            height: 670,
            onClose: function(e) {
                selectedNode.innerHTML = window.parent.annotatedSelection;
                editor.dom.remove(editor.dom.select('.hidden'));
            }
        });
    }

    editor.addButton('loomp', {
        icon: 'loomp',
        tooltip: 'Annotate',
        onclick: showDialog
    });

    editor.addMenuItem('anchor', {
        icon: 'loomp',
        text: 'Annotate',
        context: 'insert',
        onclick: showDialog
    });// Add a button that opens a window

});