#!/bin/sh

./node_modules/.bin/yeti --server &

while inotifywait -qr -e modify test/*.html; do
	./node_modules/.bin/yeti http://localhost:8211/apps/tests/angular-example.html
done
