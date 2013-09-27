#!/bin/sh
# build docs
node --stack_size=4096 build.js tests.docs-config.js

echo "BUILT. STARTING TESTS."

# run tests
if [ "$1" = "--monitor" ]
then
	karma start tests/tests.karma-config.js --auto-watch --no-single-run
else
	karma start tests/tests.karma-config.js --no-auto-watch --single-run
fi