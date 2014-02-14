#!/bin/bash
npm install
gulp dependencies
(cd ./lib/services/nodejs; npm install)

for D in ./apps/*; do
    if [ -d "${D}" ]; then
    	echo "${D}"
    	if [ -f "${D}/package.json" ]; then
    		echo "npm install"
        	(cd "${D}"; npm install; ../../node_modules/.bin/bower install)
        fi
        if [ -f "${D}/bower.json" ]; then
        	echo "bower install"
        	(cd "${D}"; ../../node_modules/.bin/bower install)
        fi
        if [ -f "${D}/gulpfile.js" ]; then
        	echo "gulp"
        	(cd "${D}"; gulp)
        fi
    fi
done