#!/bin/bash

# NOTE: This will not work unless you install python from source (I use homebrew to simplify this) - py2app does not ship the Apple-compiled python on purpose.

# set up the library locations
export THISDIR=`pwd`
export VENVSITE="$THISDIR/env/lib/python2.7/site-packages"
export PYTHONPATH="$VENVSITE:$THISDIR/libs"

# clean up from last time
rm -rf build/ dist/

# create the app (setup.py has been customised)
python setup.py py2app

# copy chameleon to a site-packages directory so that it is executed correctly
#export APPLIBDIR="dist/run.app/Contents/Resources/lib/python2.6"
#export CHAMELEONDIR="$APPLIBDIR/site-packages/chameleon"
#mkdir -p "$CHAMELEONDIR"
#cp $VENVSITE/chameleon/*.py "$CHAMELEONDIR/"

# Rename the Application bundle
mv dist/run.app dist/WebBox.app
