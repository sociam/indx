
all: enrich.css 

enrich.css : enrich.less force_look
	lessc enrich.less > enrich.css_
	mv enrich.css_ enrich.css

force_look:
	true
