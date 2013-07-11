#!/bin/bash

#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

# to change back to current dir
export MACOSDIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export PATH="$MACOSDIR:$PATH" # make sure our supplied python is run

cd "$MACOSDIR/../Resources"
export WBDIR=`pwd`
export PATH="$WBDIR/4store:$PATH" # add supplied 4store binaries to the path

# do initial per-user set up
cd "$WBDIR"
./scripts/setup_4store.sh # create /var/lib/4store (prompts for admin password)
cd "$WBDIR"
./scripts/new_4store_kb.sh # create webbox kb (if not exists)

cd "$WBDIR"
# send the 4store bin directory (subprocess.pyc fails otherwise)
../MacOS/run "$@" > /tmp/webbox.log   2>&1

