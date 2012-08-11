/*

Copyright (c) 2012, Dr. Daniel Alexander Smith
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

var DynamicTable = function(surface, data){

    var dt = this;
    dt.debugOn = false;

    if (!("dynamictables" in window)){
        window.dynamictables = [];
    }
    dynamictables.push(dt);

    dt.surface = $(surface);
    dt.columns = data.columns;
    dt.data = {};
    dt.row_divs_by_uri = {};

    dt.next_css_class = 1;
    dt.uri_to_css_class = {};

    dt.class_prefix = "dyntab_"; // TODO allow customisable
    dt.min_col_width = 50; // TODO allow customisable
    dt.col_initial_width = 200; // TODO allow customisable or based on CSS

    dt.render(); // render basic table
    dt.add_data(data.data); // add data and save into object
    dt.add_resizers(); // add the column resizers
};

DynamicTable.prototype = {
    debug: function() {
        var dt = this;
        if (dt.debugOn && "console" in window){
            console.debug(arguments);
        }
    },
    get_scrollbar_width: function(){
        var dt = this;

        // based on MIT-licensed code from: https://raw.github.com/brandonaaron/jquery-getscrollbarwidth/master/jquery.getscrollbarwidth.js

        if ("scrollbar_width" in dt){
            return dt.scrollbar_width;
        }

        var scrollbar_width = 0;        

        if ( $.browser.msie ) {
            var $textarea1 = $('<textarea cols="10" rows="2"></textarea>')
                    .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body'),
                $textarea2 = $('<textarea cols="10" rows="2" style="overflow: hidden;"></textarea>')
                    .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body');
            scrollbar_width = $textarea1.width() - $textarea2.width();
            $textarea1.add($textarea2).remove();
        } else {
            var $div = $('<div />')
                .css({ width: 100, height: 100, overflow: 'auto', position: 'absolute', top: -1000, left: -1000 })
                .prependTo('body').append('<div />').find('div')
                    .css({ width: '100%', height: 200 });
            scrollbar_width = 100 - $div.width();
            $div.parent().remove();
        }
        dt['scrollbar_width'] = scrollbar_width;
        return scrollbar_width;
    },
    get_column: function(uri){
        var dt = this;
        // get a column based on its URI or return null
        returned_column = null;
        $.each(dt.columns, function(){
            var column = this;
            if (column.uri == uri){
                returned_column = column;
                return false;
            }
        });
        return returned_column;
    },
    re_sort: function(predicate_uri){
        // TODO finish this, it was half-written at 35000ft and may be nonsense
        var dt = this;
        var index = {};
        $.each(dt.data, function(item_uri, item_data){
            if (predicate_uri in item_data){
                var vals = item_data[predicate_uri];
                $.each(vals, function(){
                    var val = this.toLowerCase(); // lower case for sorting
                    if (!(val in index)){
                        index[val] = [];
                    }
                    index[val].push(item_uri);
                });
            }
        });
        var key_arr = [];
        $.each(index, function(key, uris){
            key_arr.push(key);
        });
        key_arr = key_arr.sort();

//        $.each(index, function(value


    },
    make_sizer: function(thisCssclass, prevCssclass, cell){
        var dt = this;
        var sizer = dt.makediv(["sizer"]);

        // FIXME duped below
        var row_height = sizer.parent().height();
        sizer.css("height", row_height);
        sizer.css("min-height", row_height);

        // TODO add draggable/resize operation
        var mouseDown = false;
        var origX = 0;
        var origY = 0;
        sizer.mousedown(function(evt){
            origX = evt.clientX;
            origY = evt.clientY;

            //dt.header.data("origWidth", dt.header.width());
            //dt.row_container.data("origWidth", dt.row_container.width());
            dt.container.data("origWidth", dt.container.width());

            $(prevCssclass).each(function(){
                $(this).data("origWidth", $(this).width());
            });
            $(thisCssclass).each(function(){
                $(this).data("origWidth", $(this).width());
            });

            // disable text selection while dragging
            document.onselectstart = function(){ return false; }

            mouseDown = true;
        });
        $(document).mouseup(function(evt){
            // re-enable text selection while dragging
            document.onselectstart = function(){ return true; }

            mouseDown = false;
        });
        $(document).mousemove(function(evt){
            if (mouseDown){
                var xDiff = evt.clientX - origX;
                var yDiff = evt.clientY - origY;
               
                // check for minimum width
                var minWidth = null;
                $(prevCssclass).each(function(){
                    var newWidth = $(this).data("origWidth") + xDiff;
                    if (minWidth == null || newWidth < minWidth){
                        minWidth = newWidth;
                    }
                });
                $(thisCssclass).each(function(){
                    var newWidth = $(this).data("origWidth") - xDiff;
                    if (minWidth == null || newWidth < minWidth){
                        minWidth = newWidth;
                    }
                });

                if (minWidth >= dt.min_col_width){
                    // if we won't make a column less than the minimum
                
                    $(prevCssclass).each(function(){
                        $(this).css("width", $(this).data("origWidth") + xDiff); // more wider
                    });
                    // TODO make this so that all cells to the right move right, rather than just the neighbouring getting smaller
                    $(thisCssclass).each(function(){
                        //$(this).css("width", $(this).data("origWidth") - xDiff); // less wide
                    });
                }

                //dt.header.css("width", dt.header.data("origWidth") + xDiff);
                //dt.row_container.css("width", dt.row_container.data("origWidth") + xDiff);
                //dt.container.css("width", dt.container.data("origWidth") + xDiff);
                dt.ensure_container_width();

                dt.ensure_div_sizing();
            }
        });
        sizer.insertAfter(cell);
        cell.data("sizer", sizer);

        var sizer_width = sizer.width();
        cell.css("width", cell.width() - sizer_width);

        return sizer;
    },
    uri_to_cssclass: function(uri){
        var dt = this;
        var prefix = "uri_"; // TODO allow customisable, move to object?
        if (uri in dt.uri_to_css_class){
            return prefix+dt.uri_to_css_class[uri];
        }

        var this_css_class = dt.next_css_class;
        dt.next_css_class++;

        dt.uri_to_css_class[uri] = this_css_class;
        return prefix+this_css_class;
    },
    add_resizers: function(){
        // do this after all columns have been rendered
        var dt = this;

        var prevColumn = null;

        $.each(dt.columns, function(){
            if (prevColumn == null){
                prevColumn = this;
                return true;
            }

            var column = this;

            var thisCssclass = "."+dt.cls(dt.uri_to_cssclass(column['uri']));
            var prevCssclass = "."+dt.cls(dt.uri_to_cssclass(prevColumn['uri']));
            $(prevCssclass).each(function(){
                var cell = $(this);
                if (cell.data("sizer") == null){
                    var sizer = dt.make_sizer(thisCssclass, prevCssclass, cell);
                }
            });
            prevColumn = column;
        });
        dt.ensure_div_sizing();
    },
    ensure_div_sizing: function(){
        var dt = this;
        // we've added something or moved something, so now make sure that height/weight/pos of everything is correct

        // ensure sizers are the right height now
        $("."+dt.cls("sizer")).each(function(){
            // FIXME duped above 
            var highest = 0;
            $(this).parent().find("."+dt.cls("cell")).each(function(){
                var thisheight = $(this).height() + dt.get_extras(this);
                if (thisheight > highest){
                    highest = thisheight;
                }
            });

            $(this).css("height", highest);
            $(this).css("min-height", highest);
        });
    },
    get_column_uris: function(){
        var dt = this;

        // TODO cache this
        var column_uris = [];
        $.each(dt.columns, function(){
            var column = this;
            column_uris.push(column['uri']);
        });
        return column_uris;
    },
    makediv: function(classes){
        var dt = this;

        var class_str = "";
        $.each(classes, function(){
            var css_class = this;
            if (class_str.length > 0){
                class_str += " ";
            }
            class_str += dt.cls(css_class);
        });

        return $("<div class='"+class_str+"'></div>");
    },
    get_extras: function(div){
        var dt = this;

        div = $(div);
        return parseInt(div.css("padding-left"),10) + parseInt(div.css("padding-right"),10) + parseInt(div.css("border-left-width"),10) + parseInt(div.css("border-right-width"),10) + parseInt(div.css("margin-left"),10) + parseInt(div.css("margin-right"),10);

    },
    ensure_container_width: function(){
        // when the cells are widened or thinned we need to expand/contract the row container so the scrollbar is accurate
        var dt = this;
        var totalWidth = dt.get_scrollbar_width();
        dt.header.children().each(function(){
            var thisWidth = $(this).width() + dt.get_extras($(this));
            if (!$(this).is(".dyntab_clear")){
                totalWidth += thisWidth;
            }
        });

        if (totalWidth < dt.surface.width()){
            dt.container.css("width", dt.surface.width());
        } else {
            dt.container.css("width", totalWidth);
        }
    },
    add_data_to_row: function(rowuri, rows){
        // renders data in rows if not already there, and adds to dt.data
        var dt = this;

        dt.debug("rows", rowuri, rows);

        var rowdiv = dt.row_divs_by_uri[rowuri][0]; // TODO enable multiple rows

        var column_counter = 0;
        rowdiv.children("."+dt.cls("cell")).each(function(){
            var cell = $(this);
            var property_uri = dt.get_column_uris()[column_counter];

            var column = dt.columns[column_counter];

            if (property_uri in rows && rows[property_uri] !== undefined){
                var rowdata = rows[property_uri];

                if (!(property_uri in dt.data[rowuri])){
                    dt.data[rowuri][property_uri] = [];
                }

                if (typeof(rowdata) == "string"){
                    rowdata = [rowdata];
                }

                $.each(rowdata, function(){
                    var value = ""+this;

                    if ($.inArray(value, dt.data[rowuri][property_uri]) === -1){
                        dt.data[rowuri][property_uri].push(value);

                        var innercell = dt.makediv(["innercell"]);
                        if ("class" in column) {
                            innercell.addClass(column['class']);
                        }
                        if ("click" in column) {
                            innercell.click( function(){
                                column['click'](value);
                            });
                        }
                        if (cell.html() == "&nbsp;"){
                            cell.html("");
                        }
                        cell.append(innercell);
                        innercell.html(value);
                    }
                });
            } else {
                // not in this data, do nothing

                // but make sure the cell has a non-breaking space at minimum
                if (cell.html() == ""){
                    cell.html("&nbsp;");
                }
            }

            ++column_counter;
        });
        dt.ensure_div_sizing();
    },
    add_new_row: function(uri){
        var dt = this;

        // add whole new row (uri does not have a uri)
        var oddeven_class = (dt.row_container.children().length % 2 == 0 ? "even" : "odd");

        var row_div = dt.makediv(["row", oddeven_class]);
        dt.row_container.append(row_div);
        dt.row_divs_by_uri[uri]  = [row_div];

//        var row_cell_width = Math.floor( (row_div.width() - ) / dt.get_column_uris().length);

        col_counter = 0;
        $.each(dt.columns, function(){
            var column = this;

            var header_cell = $(dt.container.children("."+dt.cls("header")).children("."+dt.cls("column"+col_counter)));
            var row_cell_width = header_cell.width() + dt.get_extras(header_cell);

            var cell = dt.makediv(["cell","column"+col_counter,dt.uri_to_cssclass(column['uri'])]);
            cell.css("width", row_cell_width);
            row_div.append(cell);

            cell.css("width", cell.width() - dt.get_extras(cell)); // resize once visible
            
            ++col_counter;
        });

        // clear at each
        row_div.append(dt.makediv(["clear"]));
    },
    basic_label: function(uri){
        // generate a label based on a uri. crude.
        var dt = this;
        var character = "#";
        if (uri.indexOf("#") == -1){
            character = "/";
            if (uri.indexOf("/") == -1){
                character = ":";
            }
        }
        return uri.substr( uri.lastIndexOf(character)+1 );
    },
    add_data: function(data){
        var dt = this;

        dt.debug("add data", data);

        // combine into dt.data
        $.each(data, function(uri, data){
            if (!(uri in dt.data)){
                dt.data[uri] = {};
                dt.add_new_row(uri);
            }

            // check all columns exist
            $.each(data, function(predicate_uri, vals){
                var column = dt.get_column(predicate_uri);
                if (column == null){
                    dt.add_column(predicate_uri, dt.basic_label(predicate_uri)); // TODO figure out the real label somehow
                }
            });

            // add new data to row
            dt.add_data_to_row(uri, data);
        });
    },
    cls: function(name){
        var dt = this;
        // return the class with this name
        return dt.class_prefix+name;
    },
    add_column: function(predicate_uri, column_label){
        // add a new column to the table
        var dt = this;

        var col_width = dt.col_initial_width;

        // add to header
        var col_counter = dt.columns.length;

        // remove clearing div
        dt.header.children().each(function(){
            var div = $(this);
            if (div.is("."+dt.cls("clear"))){
                div.remove();
            }
        });

        // create new div
        var header_cell = dt.makediv(["cell","column"+col_counter,dt.uri_to_cssclass(predicate_uri)]);
        header_cell.css("width", col_width);
        //dt.header.css("width", dt.header.width() + dt.get_extras(dt.header) + col_width);
        dt.header.append(header_cell);


        header_cell.css("width", header_cell.width() - dt.get_extras(header_cell)); // resize once visible
        header_cell.html(column_label);

        // clear at each
        dt.header.append(dt.makediv(["clear"]));
       
        dt.ensure_container_width();

        // we dont modify surface, because surface might scroll to the size of container
//        dt.surface.css("width", dt.header.width() + dt.get_extras(dt.header));

        var column = {'uri': predicate_uri, 'label': column_label};
        dt.columns.push(column);

        // add a resizer
//        dt.add_resizers();

        // add to existing rows
        dt.row_container.children().each(function(){
            // we've added the resizer, so just add a cell here
            var row_div = $(this);

            // first remove the clear div
            row_div.children().each(function(){
                var div = $(this);
                if (div.is("."+dt.cls("clear"))){
                    div.remove();
                }
            });

            // add the new cell
            var row_cell_width = col_width;

            col_counter = dt.columns.length - 1; // assume we're the last column, because we were just added

            var cell = dt.makediv(["cell","column"+col_counter,dt.uri_to_cssclass(column['uri'])]);
            cell.css("width", header_cell.width() + dt.get_extras(header_cell));
            row_div.append(cell);

            cell.css("width", cell.width() - dt.get_extras(cell)); // resize once visible            
            // re-add the clear div
            row_div.append(dt.makediv(["clear"]));
        });
    },
    render: function(){
        var dt = this;

        dt.surface.addClass(dt.cls("table"));

        // create a container
        dt.container = dt.makediv(["container"]);
        dt.surface.append(dt.container);

        // create the header
        dt.header = dt.makediv(["header"]);
        dt.container.append(dt.header);

        // create a row container
        dt.row_container = dt.makediv(["row_container"]);
        dt.container.append(dt.row_container);

        var header_cell_width = Math.floor( (dt.header.width() - dt.get_scrollbar_width() ) / dt.get_column_uris().length);

        // add header row
        var col_counter = 0;
        $.each(dt.columns, function(){
            var column = this;
            column['label'] = ""+column['label'];

            var header_cell = dt.makediv(["cell","column"+col_counter,dt.uri_to_cssclass(column['uri'])]);
            header_cell.css("width", header_cell_width);
            dt.header.append(header_cell);

            header_cell.css("width", header_cell.width() - dt.get_extras(header_cell)); // resize once visible
            header_cell.html(column['label']);
            ++col_counter;
        });
        // clear at each
        dt.header.append(dt.makediv(["clear"]));
    }
};

