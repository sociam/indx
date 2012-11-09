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

# import core modules
import sys, os, logging, json, shutil, getpass, re
from webbox.setup import WebBoxSetup
from webbox.server import WebServer

# Initial Setup of ~/.webbox
kbname = "webbox_" + getpass.getuser() # per user knowledge base
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
setup = WebBoxSetup()
config = setup.setup(webbox_dir, "webbox.json.default", kbname) # directory, default config, kbname

# add additional binary paths to the PATH
for bindir in config['server']['bindirs']:
    os.environ['PATH'] = os.path.join(os.path.dirname(__file__), bindir) + ":" + os.environ['PATH']

# show debug messages in log file
log_handler = logging.FileHandler(config['server']['log'], "a")
log_handler.setLevel(logging.DEBUG)
logger = logging.getLogger() # root logger
logger.addHandler(log_handler)
logger.debug("Logger initialised")
logger.setLevel(logging.DEBUG)

server = WebServer(config, setup.get_config_filename(), os.path.dirname(__file__))
server.run()

