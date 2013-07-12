#!/bin/sh

./node_modules/.bin/yeti --server &

while inotifywait -r -e modify test/*.html; do
	./node_modules/.bin/yeti test/*.html
done
