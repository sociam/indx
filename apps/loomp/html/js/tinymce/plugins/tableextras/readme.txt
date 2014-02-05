TABLE EXTRAS
------------

For TinyMCE 3.x
Tested with Fx 3, MSIE 6, MSIE 7, Opera 9.64 and Safari


INSTALL:

1. Copy the tableextras folder to the tiny_mce/plugins folder.
2. Add "tableextras"(without quotes) to your TinyMCE plug in configuration.
3. Add "tabledraw" and "convertcelltype" (without quotes) to your advanced button configuration.


PLUG IN OPTIONS:

tableextras_row_size: <integer>
	This option sets the row size for the table.
	
tableextras_col_size: <integer>
	This option sets the colum size for the table.

Example configuration:

tinyMCE.init({
	...
	mode: 'textareas',
	theme: 'advanced',
	plugins: 'tableextras,table ...',
	theme_advanced_buttons1: 'tabledraw,tablecontrols,convertcelltype',
	theme_advanced_buttons2: '',
	theme_advanced_buttons3: '',
	tableextras_col_size: 10, // Optional
	tableextras_row_size: 10, // Optional
	...
});


TODO:

- When converting to TH elements the row should be encapsulated with a THEAD element.