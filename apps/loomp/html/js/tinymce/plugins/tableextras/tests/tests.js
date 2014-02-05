/**
 * We are using the YUI JavaScript test framework to do the testing.
 * This script is not a real unit test, but does some automatic testing of the plug in.
 * 
 * For more info: http://developer.yahoo.com/yui/yuitest/
 *
 * INSTRUCTIONS:
 *
 * 1.
 * Add these scripts to the <head> element in you document:
 *
 * <!--CSS-->
 * <link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.7.0/build/logger/assets/logger.css">
 * <link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.7.0/build/yuitest/assets/testlogger.css">
 *
 * <!-- Dependencies --> 
 * <script type="text/javascript" src="http://yui.yahooapis.com/2.7.0/build/yahoo-dom-event/yahoo-dom-event.js"></script>
 * <script type="text/javascript" src="http://yui.yahooapis.com/2.7.0/build/logger/logger-min.js"></script>
 * <!-- Source File -->
 * <script type="text/javascript" src="http://yui.yahooapis.com/2.7.0/build/yuitest/yuitest-min.js"></script>
 *
 * 2.
 * Add this script at the end of the document(before </body>)
 *
 * <script type="text/javascript" src="<path to the plugin folder>/tableextras/tests/tests.js"></script>
 */

var objTablePluginTestCase = new YAHOO.tool.TestCase({

	name: "Table Extras Plugin",
        
	setUp : function ()
	{
		this.waitBeforeStart = 2000;
		this.editorId = 'elm1';
		this.tablePanelId = 'te-panel';
		this.infoId = 'te-info';
		this.delayBetweenTests = 100;
	},

	tearDown : function ()
	{
		delete this.waitBeforeStart;
		delete this.editorId;
		delete this.tablePanelId;
		delete this.infoId;
		delete this.delayBetweenTests;
	},
	// -------------------------------------------------------------------------
	
	test_init: function()
	{
		// Wait 2 seconds so the editor is fully initalized.
		this.wait(function()
		{
		}, this.waitBeforeStart);   		
	},
	// -------------------------------------------------------------------------
	
	test_clickCreateTable_1: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemCreateTableButton = document.getElementById(this.editorId + '_tabledraw');

		UserAction.click(elemCreateTableButton);
		Assert.isTrue(elemCreateTableButton.className.indexOf('mceButtonActive') > -1);
	},
	// -------------------------------------------------------------------------

	test_panelIsOpen: function()
	{
		var Assert = YAHOO.util.Assert;
		var elemPanel = document.getElementById(this.tablePanelId);

		Assert.isTrue(elemPanel.style.display === 'block');
	},
	// -------------------------------------------------------------------------

	test_panelIsClosedOnDocumentMouseDown: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		this.wait(function()
		{
			UserAction.mousedown(document.body);
			Assert.isTrue(elemPanel.style.display === 'none');
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------
	
	test_clickCreateTable_2: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemCreateTableButton = document.getElementById(this.editorId + '_tabledraw');

		this.wait(function()
		{
			UserAction.click(elemCreateTableButton);
			Assert.isTrue(elemCreateTableButton.className.indexOf('mceButtonActive') > -1);
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_panelIsClosedOnEditorDocumentClick: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		var objEditor = tinyMCE.get('elm2');
		var elemEditorBody = objEditor.getBody()

		this.wait(function()
		{
			UserAction.click(elemEditorBody);
			Assert.isTrue(elemPanel.style.display === 'none');
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_clickCreateTable_3: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemCreateTableButton = document.getElementById(this.editorId + '_tabledraw');

		this.wait(function()
		{
			UserAction.click(elemCreateTableButton);
			Assert.isTrue(elemCreateTableButton.className.indexOf('mceButtonActive') > -1);
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_panelIsClosedOnInfoBarClick: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		var elemInfo = document.getElementById(this.infoId);

		this.wait(function()
		{
			UserAction.click(elemInfo);
			Assert.isTrue(elemPanel.style.display === 'none');
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_clickCreateTable_4: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemCreateTableButton = document.getElementById(this.editorId + '_tabledraw');

		this.wait(function()
		{
			UserAction.click(elemCreateTableButton);
			Assert.isTrue(elemCreateTableButton.className.indexOf('mceButtonActive') > -1);
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_selectCells_7x7: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		var nlTableCells = elemPanel.getElementsByTagName('td');
		var elemInfo =  document.getElementById(this.infoId);

		this.wait(function()
		{
			UserAction.mouseover(nlTableCells[48])
			Assert.areSame(elemInfo.innerHTML, '7 x 7');
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_selectCells_4x5: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		var nlTableCells = elemPanel.getElementsByTagName('td');
		var elemInfo =  document.getElementById(this.infoId);

		this.wait(function()
		{
			UserAction.mouseover(nlTableCells[25])
			Assert.areSame(elemInfo.innerHTML, '4 x 5');
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------

	test_insertTable: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;
		var elemPanel = document.getElementById(this.tablePanelId);
		var nlTableCells = elemPanel.getElementsByTagName('td');
		var objEditor = tinyMCE.get('elm2');
		var elemEditorBody = objEditor.getBody()

		this.wait(function()
		{
			UserAction.click(nlTableCells[25]);
			Assert.areSame(1, elemEditorBody.getElementsByTagName('table').length);
		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------
	
	test_countCellsInInsertedTable: function()
	{
		var Assert = YAHOO.util.Assert;
		var elemPanel = document.getElementById(this.tablePanelId);
		var nlTableCells = elemPanel.getElementsByTagName('td');
		var objEditor = tinyMCE.get(this.editorId);
		var elemEditorBody = objEditor.getBody()
		Assert.areSame(20, elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('td').length);
	},
	// -------------------------------------------------------------------------
	
	test_convertCellsInRowToTH: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;

		var elemConvertCellsButton = document.getElementById(this.editorId + '_convertcellsinrow');

		var objEditor = tinyMCE.get(this.editorId);
		var elemEditorBody = objEditor.getBody()
		
		var elemRow1 = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0];
		var nlCells = elemRow1.getElementsByTagName('td');
		
		for (var i = 0; i < nlCells.length; i ++ )
		{
			nlCells[i].innerHTML = String.fromCharCode( (65 + i) );
		}

		var elemToSelect = nlCells[0];

		// !!!Fix for IE.
		elemToSelect = tinymce.isIE ? elemToSelect : elemToSelect.firstChild || elemToSelect;

		objEditor.selection.select( elemToSelect );
		objEditor.selection.collapse(0);
		UserAction.click(elemEditorBody);

		this.wait(function()
		{
			UserAction.click(elemConvertCellsButton);
	
			elemRow1 = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0];
			nlCells = elemRow1.getElementsByTagName('th');
	
			var isTableHeader = true;
			for (var i = 0; i < nlCells.length; i ++ )
			{
				if ( nlCells[i].nodeName !== 'TH')
				{
					isTableHeader = false;
					break;
				}
			}
			
			Assert.isTrue(isTableHeader);

		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------
	
	test_convertCellsInRowToTD: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;

		var elemConvertCellsButton = document.getElementById(this.editorId + '_convertcellsinrow');

		var objEditor = tinyMCE.get(this.editorId);
		var elemEditorBody = objEditor.getBody()
		
		var elemRow1 = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0];
		var nlCells = elemRow1.getElementsByTagName('td');

		this.wait(function()
		{
			UserAction.click(elemConvertCellsButton);
			
			var isTableData = true;
			
			for (var i = 0; i < nlCells.length; i ++ )
			{
				if ( nlCells[i].nodeName !== 'TD')
				{
					isTableData = false;
					break;
				}
			}
			
			Assert.isTrue(isTableData);

		}, this.delayBetweenTests);   		
	},
	// -------------------------------------------------------------------------
	
	test_isThElementWithStylesIntact: function()
	{
		var Assert = YAHOO.util.Assert;
		var UserAction = YAHOO.util.UserAction;

		var elemConvertCellsButton = document.getElementById(this.editorId + '_convertcellsinrow');

		var objEditor = tinyMCE.get(this.editorId);
		var elemEditorBody = objEditor.getBody()

		var elemRow1 = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0];
		elemRow1.className = 'tablerow1';
		
		var nlTd = elemRow1.getElementsByTagName('td');
		for (var i = 0; i < nlTd.length; i ++ )
		{
			nlTd[i].style.width = '60px';
		}
		
		this.wait(function()
		{
			UserAction.click(elemConvertCellsButton);
			elemRow1 = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0];
			Assert.areSame('60px', elemRow1.getElementsByTagName('th')[0].style.width);
		}, this.delayBetweenTests);   		
	},
	
	// -------------------------------------------------------------------------
	
	test_cursorIsInFirstCell: function()
	{
		var Assert = YAHOO.util.Assert;
		var objEditor = tinyMCE.get(this.editorId);
		var elemEditorBody = objEditor.getBody()
		var objSelection = objEditor.selection.getNode();
		var elemFirstTd = elemEditorBody.getElementsByTagName('table')[0].getElementsByTagName('tr')[0].getElementsByTagName('th')[0];

		Assert.areSame(objSelection, elemFirstTd);
	}
	
});

YAHOO.tool.TestRunner.add(objTablePluginTestCase);

var objLogger = new YAHOO.tool.TestLogger();

YAHOO.tool.TestRunner.run();


