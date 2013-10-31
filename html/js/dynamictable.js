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
    dt.rowDivsByUri = {};

    dt.nextCssClass = 1;
    dt.uriToCssClass = {};

    dt.classPrefix = "dyntab_"; // TODO allow customisable
    dt.minColWidth = 50; // TODO allow customisable
    dt.colInitialWidth = 200; // TODO allow customisable or based on CSS

    dt.render(); // render basic table
    dt.addData(data.data); // add data and save into object
    dt.addResizers(); // add the column resizers
};

DynamicTable.prototype = {
    debug: function() {
        var dt = this;
        if (dt.debugOn && "console" in window){
            console.debug(arguments);
        }
    },
    changeVal: function(callback){
        var dt = this;
        // set a callback when a user has changed a triple.
        // send the from and to triples back (with types)
        dt['changeCallback'] = callback;
    },
    getScrollbarWidth: function(){
        var dt = this;

        // based on MIT-licensed code from: https://raw.github.com/brandonaaron/jquery-getscrollbarwidth/master/jquery.getscrollbarwidth.js

        if ("scrollbarWidth" in dt){
            return dt.scrollbarWidth;
        }

        var scrollbarWidth = 0;        

        if ( $.browser.msie ) {
            var $textarea1 = $('<textarea cols="10" rows="2"></textarea>')
                    .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body'),
                $textarea2 = $('<textarea cols="10" rows="2" style="overflow: hidden;"></textarea>')
                    .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body');
            scrollbarWidth = $textarea1.width() - $textarea2.width();
            $textarea1.add($textarea2).remove();
        } else {
            var $div = $('<div />')
                .css({ width: 100, height: 100, overflow: 'auto', position: 'absolute', top: -1000, left: -1000 })
                .prependTo('body').append('<div />').find('div')
                    .css({ width: '100%', height: 200 });
            scrollbarWidth = 100 - $div.width();
            $div.parent().remove();
        }
        dt['scrollbarWidth'] = scrollbarWidth;
        return scrollbarWidth;
    },
    getColumn: function(uri){
        var dt = this;
        // get a column based on its URI or return null
        returnedColumn = null;
        $.each(dt.columns, function(){
            var column = this;
            if (column.uri == uri){
                returnedColumn = column;
                return false;
            }
        });
        return returnedColumn;
    },
    reSort: function(predicateUri){
        // TODO finish this, it was half-written at 35000ft and may be nonsense
        var dt = this;
        var index = {};
        $.each(dt.data, function(itemUri, itemData){
            if (predicateUri in itemData){
                var vals = itemData[predicateUri];
                $.each(vals, function(){
                    var val = this.toLowerCase(); // lower case for sorting
                    if (!(val in index)){
                        index[val] = [];
                    }
                    index[val].push(itemUri);
                });
            }
        });
        var keyArr = [];
        $.each(index, function(key, uris){
            keyArr.push(key);
        });
        keyArr = keyArr.sort();

//        $.each(index, function(value


    },
    makeSizer: function(thisCssclass, prevCssclass, cell){
        var dt = this;
        var sizer = dt.makediv(["sizer"]);

        // FIXME duped below
        var rowHeight = sizer.parent().height();
        sizer.css("height", rowHeight);
        sizer.css("min-height", rowHeight);

        // TODO add draggable/resize operation
        var mouseDown = false;
        var origX = 0;
        var origY = 0;
        sizer.mousedown(function(evt){
            origX = evt.clientX;
            origY = evt.clientY;

            //dt.header.data("origWidth", dt.header.width());
            //dt.rowContainer.data("origWidth", dt.rowContainer.width());
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

                if (minWidth >= dt.minColWidth){
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
                //dt.rowContainer.css("width", dt.rowContainer.data("origWidth") + xDiff);
                //dt.container.css("width", dt.container.data("origWidth") + xDiff);
                dt.ensureContainerWidth();

                dt.ensureDivSizing();
            }
        });
        sizer.insertAfter(cell);
        cell.data("sizer", sizer);

        var sizerWidth = sizer.width();
        cell.css("width", cell.width() - sizerWidth);

        return sizer;
    },
    uriToCssclass: function(uri){
        var dt = this;
        var prefix = "uri_"; // TODO allow customisable, move to object?
        if (uri in dt.uriToCssClass){
            return prefix+dt.uriToCssClass[uri];
        }

        var thisCssClass = dt.nextCssClass;
        dt.nextCssClass++;

        dt.uriToCssClass[uri] = thisCssClass;
        return prefix+thisCssClass;
    },
    addResizers: function(){
        // do this after all columns have been rendered
        var dt = this;

        var prevColumn = null;

        $.each(dt.columns, function(){
            if (prevColumn == null){
                prevColumn = this;
                return true;
            }

            var column = this;

            var thisCssclass = "."+dt.cls(dt.uriToCssclass(column['uri']));
            var prevCssclass = "."+dt.cls(dt.uriToCssclass(prevColumn['uri']));
            $(prevCssclass).each(function(){
                var cell = $(this);
                if (cell.data("sizer") == null){
                    var sizer = dt.makeSizer(thisCssclass, prevCssclass, cell);
                }
            });
            prevColumn = column;
        });
        dt.ensureDivSizing();
    },
    ensureDivSizing: function(){
        var dt = this;
        // we've added something or moved something, so now make sure that height/weight/pos of everything is correct

        // ensure sizers are the right height now
        $("."+dt.cls("sizer")).each(function(){
            // FIXME duped above 
            var highest = 0;
            $(this).parent().find("."+dt.cls("cell")).each(function(){
                var thisheight = $(this).height() + dt.getExtras(this);
                if (thisheight > highest){
                    highest = thisheight;
                }
            });

            $(this).css("height", highest);
            $(this).css("min-height", highest);
        });
    },
    getColumnUris: function(){
        var dt = this;

        // TODO cache this
        var columnUris = [];
        $.each(dt.columns, function(){
            var column = this;
            columnUris.push(column['uri']);
        });
        return columnUris;
    },
    makediv: function(classes){
        var dt = this;

        var classStr = "";
        $.each(classes, function(){
            var cssClass = this;
            if (classStr.length > 0){
                classStr += " ";
            }
            classStr += dt.cls(cssClass);
        });

        return $("<div class='"+classStr+"'></div>");
    },
    getExtras: function(div){
        var dt = this;

        div = $(div);
        return parseInt(div.css("padding-left"),10) + parseInt(div.css("padding-right"),10) + parseInt(div.css("border-left-width"),10) + parseInt(div.css("border-right-width"),10) + parseInt(div.css("margin-left"),10) + parseInt(div.css("margin-right"),10);

    },
    ensureContainerWidth: function(){
        // when the cells are widened or thinned we need to expand/contract the row container so the scrollbar is accurate
        var dt = this;
        var totalWidth = dt.getScrollbarWidth();
        dt.header.children().each(function(){
            var thisWidth = $(this).width() + dt.getExtras($(this));
            if (!$(this).is(".dyntab-clear")){
                totalWidth += thisWidth;
            }
        });

        if (totalWidth < dt.surface.width()){
            dt.container.css("width", dt.surface.width());
        } else {
            dt.container.css("width", totalWidth);
        }
    },
    addDataToRow: function(rowuri, rows){
        // renders data in rows if not already there, and adds to dt.data
        var dt = this;

        dt.debug("rows", rowuri, rows);

        rows = rows[0]; // TODO enable multiple rows;
        var rowdiv = dt.rowDivsByUri[rowuri][0]; // TODO enable multiple rows

        dt.debug("rowdiv", rowdiv);

        var columnCounter = 0;
        rowdiv.children("."+dt.cls("cell")).each(function(){
            var cell = $(this);
            var propertyUri = dt.getColumnUris()[columnCounter];

            var column = dt.columns[columnCounter];

            if (propertyUri in rows && rows[propertyUri] !== undefined){
                var rowdata = rows[propertyUri];

                dt.debug("rowdata", rowdata);

                if (!(propertyUri in dt.data[rowuri])){
                    dt.data[rowuri][propertyUri] = [];
                }

                if (typeof(rowdata) === "string"){
                    rowdata = [rowdata];
                }

                dt.debug("rowdata2", rowdata);
                $.each(rowdata, function(){

                    var value = this['value'];
                    var type = this['type']; // uri, literal

                    if ($.inArray(value, dt.data[rowuri][propertyUri]) === -1){
                        dt.data[rowuri][propertyUri].push(value);

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

                        innercell.data("type", type);
                        innercell.data("origvalue", value);
                        innercell.data("predicate", propertyUri);
                        innercell.data("subject", rowuri);

                        // TODO call this once to optimise rather than in this loop
                        innercell.bind("dblclick", function(evt){
                            if ("changeCallback" in dt){
                                var icell = $(evt.target);
                                var origvalue = icell.data("origvalue");
                                var type = icell.data("type");
                                var subject = icell.data("subject");
                                var predicate = icell.data("predicate");

                                var input = $("<input type='text' value='"+origvalue+"' />");
                                input.bind("keydown", function(evt){
                                    if (evt.which == 13){
                                        var target = $(evt.target);
                                        var newval = target.val();

                                        var icel = target.parent();
                                        icel.css("padding", 5);
                                        target.remove();
                                        icel.html(newval);
                                        dt.ensureDivSizing();

                                        if (newval == origvalue){
                                            return;
                                        };

                                        // call the callback
                                        var fromObj = origvalue;
                                        if (type === "uri"){
                                            fromObj = "<"+fromObj+">";
                                        } else if (type === "literal"){
                                            fromObj = "\""+fromObj+"\"";
                                        }
                                        var toObj = newval;
                                        if (type === "uri"){
                                            toObj = "<"+toObj+">";
                                        } else if (type === "literal"){
                                            toObj = "\""+toObj+"\"";
                                        }

                                        var from = {subject: "<"+subject+">", predicate: "<"+predicate+">", object: fromObj};
                                        var to = {subject: "<"+subject+">", predicate: "<"+predicate+">", object: toObj};
                                        dt.changeCallback(from, to);

                                        // assume successful, so reset the original value to the new one
                                        origvalue = newval;
                                        icel.data("origvalue", newval);
                                    }
                                });
                                icell.html("");
                                icell.css("padding", 4);
                                icell.append(input);
                                dt.ensureDivSizing();
                            }
                        });

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

            ++columnCounter;
        });
        dt.ensureDivSizing();
    },
    addNewRow: function(uri){
        var dt = this;

        // add whole new row (uri does not have a uri)
        var oddevenClass = (dt.rowContainer.children().length % 2 == 0 ? "even" : "odd");

        var rowDiv = dt.makediv(["row", oddevenClass]);
        dt.rowContainer.append(rowDiv);
        dt.rowDivsByUri[uri]  = [rowDiv];

//        var rowCellWidth = Math.floor( (rowDiv.width() - ) / dt.getColumnUris().length);

        colCounter = 0;
        $.each(dt.columns, function(){
            var column = this;

            var headerCell = $(dt.container.children("."+dt.cls("header")).children("."+dt.cls("column"+colCounter)));
            var rowCellWidth = headerCell.width() + dt.getExtras(headerCell);

            var cell = dt.makediv(["cell","column"+colCounter,dt.uriToCssclass(column['uri'])]);
            cell.css("width", rowCellWidth);
            rowDiv.append(cell);

            cell.css("width", cell.width() - dt.getExtras(cell)); // resize once visible
            
            ++colCounter;
        });

        // clear at each
        rowDiv.append(dt.makediv(["clear"]));
    },
    basicLabel: function(uri){
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
    addData: function(data){
        var dt = this;

        dt.debug("add data", data);

        // combine into dt.data
        $.each(data, function(uri, subdata){
            dt.debug("uri",uri,"subdata",subdata);
            if (!(uri in dt.data)){
                dt.data[uri] = {};
                dt.addNewRow(uri);
            }

            // check all columns exist
            $.each(subdata, function(){
                    var item = this;
                    dt.debug("item", item);
                    $.each(item, function(predicateUri, vals){
                        dt.debug("predicateUri",predicateUri,"vals",vals);
                        var column = dt.getColumn(predicateUri);
                        if (column == null){
                            dt.addColumn(predicateUri, dt.basicLabel(predicateUri)); // TODO figure out the real label somehow
                        }
                    });
            });

            // add new data to row
            dt.addDataToRow(uri, subdata);
        });
    },
    cls: function(name){
        var dt = this;
        // return the class with this name
        return dt.classPrefix+name;
    },
    addColumn: function(predicateUri, columnLabel){
        // add a new column to the table
        var dt = this;

        var colWidth = dt.colInitialWidth;

        // add to header
        var colCounter = dt.columns.length;

        // remove clearing div
        dt.header.children().each(function(){
            var div = $(this);
            if (div.is("."+dt.cls("clear"))){
                div.remove();
            }
        });

        // create new div
        var headerCell = dt.makediv(["cell","column"+colCounter,dt.uriToCssclass(predicateUri)]);
        headerCell.css("width", colWidth);
        //dt.header.css("width", dt.header.width() + dt.getExtras(dt.header) + colWidth);
        dt.header.append(headerCell);


        headerCell.css("width", headerCell.width() - dt.getExtras(headerCell)); // resize once visible
        headerCell.html(columnLabel);

        // clear at each
        dt.header.append(dt.makediv(["clear"]));
       
        dt.ensureContainerWidth();

        // we dont modify surface, because surface might scroll to the size of container
//        dt.surface.css("width", dt.header.width() + dt.getExtras(dt.header));

        var column = {'uri': predicateUri, 'label': columnLabel};
        dt.columns.push(column);

        // add a resizer
//        dt.addResizers();

        // add to existing rows
        dt.rowContainer.children().each(function(){
            // we've added the resizer, so just add a cell here
            var rowDiv = $(this);

            // first remove the clear div
            rowDiv.children().each(function(){
                var div = $(this);
                if (div.is("."+dt.cls("clear"))){
                    div.remove();
                }
            });

            // add the new cell
            var rowCellWidth = colWidth;

            colCounter = dt.columns.length - 1; // assume we're the last column, because we were just added

            var cell = dt.makediv(["cell","column"+colCounter,dt.uriToCssclass(column['uri'])]);
            cell.css("width", headerCell.width() + dt.getExtras(headerCell));
            rowDiv.append(cell);

            cell.css("width", cell.width() - dt.getExtras(cell)); // resize once visible            
            // re-add the clear div
            rowDiv.append(dt.makediv(["clear"]));
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
        dt.rowContainer = dt.makediv(["rowContainer"]);
        dt.container.append(dt.rowContainer);

        var headerCellWidth = Math.floor( (dt.header.width() - dt.getScrollbarWidth() ) / dt.getColumnUris().length);

        // add header row
        var colCounter = 0;
        $.each(dt.columns, function(){
            var column = this;
            column['label'] = ""+column['label'];

            var headerCell = dt.makediv(["cell","column"+colCounter,dt.uriToCssclass(column['uri'])]);
            headerCell.css("width", headerCellWidth);
            dt.header.append(headerCell);

            headerCell.css("width", headerCell.width() - dt.getExtras(headerCell)); // resize once visible
            headerCell.html(column['label']);
            ++colCounter;
        });
        // clear at each
        dt.header.append(dt.makediv(["clear"]));
    }
};

