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

import os, json, re

# load configuration into 'config' variable
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
webbox_config = webbox_dir + os.sep + "webbox.json"
conf_fh = open(webbox_config, "r")

# load the json, parsing out comments manually
comment_re = re.compile(r'#.*$')
config_lines = ""
for line in conf_fh.readlines():
    line = re.sub(comment_re, '', line)
    config_lines += line
conf_fh.close()

config = json.loads(config_lines)

# get values
values = {
    "PORT": config['4store']['port'],
    "KBNAME": config['4store']['kbname'],
    "RWW_PORT": config['rww']['port'],
    "RWW_LD": os.path.join(webbox_dir,config['webbox']['data_dir'],config['rww']['ld']),
    "RWW_JAR": "${SECURESTORE_HOME}" + os.sep + config['rww']['jar'],
    "LOG_RWW": os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['log_dir'],config['rww']['log']),
    "LOG_4S": os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['log_dir'],config['4store']['log']),
    "LOG_SECURESTORE": os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['log_dir'],config['webbox']['log']),
}


# write output
out = open("scripts/config.sh", "w")
out.write('#!/bin/bash\n')
out.write('export PATH="${SECURESTORE_HOME}/4store:$PATH"\n\n')

# output vars
for key in values:
    out.write("export %s=\"%s\"\n" % (key, values[key]))

