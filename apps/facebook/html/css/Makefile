
all: fb.css 

fb.css : fb.less force_look
	lessc fb.less > fb.css_
	mv fb.css_ fb.css

force_look:
	true
