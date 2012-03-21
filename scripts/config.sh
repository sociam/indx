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

export THISDIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

#. "${THISDIR}/pwd.sh" # gives SECURESTORE_HOME

export PORT="8212"
export KBNAME="securestore"
export RWW_PORT="8213"
export RWW_LD="${SECURESTORE_HOME}/data/rww"
export RWW_JAR="${SECURESTORE_HOME}/rww/read-write-web.jar"
export LOG_RWW="${SECURESTORE_HOME}/logs/rww.log"
export LOG_4S="${SECURESTORE_HOME}/logs/4store.log"
export LOG_SECURESTORE="${SECURESTORE_HOME}/logs/securestore.log"
