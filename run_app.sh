#!/bin/bash

#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
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
cd "$MACOSDIR/../Resources"

export SSDIR=`pwd`
export SECURESTORE_HOME="$SSDIR"


bashtrap()
{
    echo "Exiting..."

    echo "Killing SecureStore, pid: $PID_SECURESTORE"
    kill "$PID_SECURESTORE"
    echo "Killing RWW, pid: $PID_RWW"
    kill "$PID_RWW"
    echo "Killing 4s-httpd, pid: $PID_4S_HTTPD"
    kill "$PID_4S_HTTPD"
    echo "Killing 4s-backend, pid: $PID_4S_BACKEND"
    kill "$PID_4S_BACKEND"
    echo "done."
}

# set up bash trap, will exec bashtrap() function on ctrl-c
trap bashtrap INT

# run rww, output to log
cd "$SSDIR"
. scripts/run_rww.sh

cd "$SSDIR"
# run 4store, output to log
. scripts/run_4store.sh

cd "$SSDIR"
# run securestore, output to log
##source env/bin/activate
. scripts/config.sh

# run the py2app runner and pass arguments along
#./run "$@" >> "${LOG_SECURESTORE}" 2>> "${LOG_SECURESTORE}" &
../MacOS/run "$@"
export PID_SECURESTORE=$!

# wait..
echo "WebBox terminated, calling bashtrap..."
bashtrap


