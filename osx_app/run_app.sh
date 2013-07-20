#!/bin/bash
#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
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

