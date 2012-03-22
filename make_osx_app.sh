#!/bin/bash

# NOTE: This will not work unless you install python from source (I use homebrew to simplify this) - py2app does not ship the Apple-compiled python on purpose.

# set up the library locations
export PYTHON_VER="2.7" # customise - this is based on what homebrew supplied
export THISDIR=`pwd`
export VENVSITE="$THISDIR/env/lib/python$PYTHON_VER/site-packages"
export PYTHONPATH="$VENVSITE:$THISDIR/libs"

# clean up from last time
rm -rf build/ dist/
rm -r logs/*

# create the app (setup.py has been customised)
python setup.py py2app

# Rename the Application bundle
mv dist/run.app dist/WebBox.app

# copy our run script in
cp run_app.sh dist/WebBox.app/Contents/MacOS/

# make all scripts executable
find dist/WebBox.app -name '*.sh' -exec chmod +x {} \;
chmod +x dist/WebBox.app/Contents/Resources/4store/*

# replace run with run.sh in the bundle Info.plist
python scripts/change_app_run_script.py dist/WebBox.app/Contents/Info.plist

echo "Now make a DMG of the right size, use AutoOpen to make it pop up, remove its toolbars, make the icons bigger, copy in the app, copy in a link to /Applications, resize, move to top left, and then zip."

