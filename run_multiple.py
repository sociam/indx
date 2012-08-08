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
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import sys, os, logging, json
from webboxmulti import WebBoxMulti


# load configuration into 'config' variable
config_filename = "multi_config.json"
conf_fh = open(config_filename, "r")
config = json.loads(conf_fh.read())
conf_fh.close()

config['config_filename'] = config_filename
config['management']['basedir'] = os.path.dirname(__file__)

# show debug messages in the log
log_handler = logging.FileHandler(config['log'], "a")
log_handler.setLevel(logging.DEBUG)

logger = logging.getLogger() # root logger
logger.addHandler(log_handler)
logger.debug("Logger initialised")
logger.setLevel(logging.DEBUG)

# add additional binary paths to the PATH
for bindir in config['bindirs']:
    os.environ['PATH'] = os.path.join(os.path.dirname(__file__), bindir) + ":" + os.environ['PATH']

webbox_multi = WebBoxMulti(config)

