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


# This is a python script which reads the config file and creates config.sh - a bash script which contains the port/hostname (etc.) from the config, so that the test scripts (etc.) act on the current configuration.


# load configuration file
import ConfigParser
config = ConfigParser.ConfigParser()
config.read("securestore.cfg")

# map from config to k/v pairs of bash config
# section / key / bash variable / prepend with home dir yes-no
map = [
    ("4store","port","PORT",False),
    ("4store","kbname","KBNAME",False),
    ("rww","port","RWW_PORT",False),
    ("rww","ld","RWW_LD",True),
    ("rww","jar","RWW_JAR",True),
    ("rww","log","LOG_RWW",True),
    ("4store","log","LOG_4S",True),
    ("securestore","log","LOG_SECURESTORE",True),
]

# write output
out = open("scripts/config.sh", "w")
out.write('#!/bin/bash\n')
out.write('export THISDIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"\n\n')
out.write('. "${THISDIR}/pwd.sh" # gives SECURESTORE_HOME\n\n')

# output vars
for drc in map:
    val = config.get(drc[0], drc[1])
    field = drc[2]
    
    prepend = ""
    if drc[3]:
        prepend="${SECURESTORE_HOME}/"

    out.write("export %s=\"%s%s\"\n" % (field, prepend, val))

