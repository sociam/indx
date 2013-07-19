#!/bin/bash
#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

# NOTE: This will not work unless you install python from source (I use homebrew to simplify this) - py2app does not ship the Apple-compiled python on purpose.

# set up the library locations
export PYTHON_VER="2.7" # customise - this is based on what homebrew supplied
export THISDIR=`pwd`
export VENVSITE="$THISDIR/../env/lib/python$PYTHON_VER/site-packages"
export PYTHONPATH="$VENVSITE:$THISDIR/../libs"

# clean up from last time
rm -rf build/ dist/

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
python change_app_run_script.py dist/WebBox.app/Contents/Info.plist

./build-dmg.sh

