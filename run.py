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

# import core modules
import sys, os, logging, json, shutil, getpass, re
from webboxsetup import WebBoxSetup
from webbox import WebBox
from webserver import WebServer

# Initial Setup of ~/.webbox
kbname = "webbox_" + getpass.getuser() # per user knowledge base
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
setup = WebBoxSetup()
setup.setup(webbox_dir, "webbox.json.default", kbname) # directory, default config, kbname


# load configuration into 'config' variable
webbox_config = webbox_dir + os.sep + "webbox.json"
conf_fh = open(webbox_config, "r")
config = json.loads(conf_fh.read())
conf_fh.close()

# add the webbox path to the config (at runtime only)
config['webbox']['webbox_dir'] = webbox_dir
# add websockets server details (at runtime only)
config['webbox']['ws_hostname'] = config['server']['ws_hostname']
config['webbox']['ws_port'] = config['server']['ws_port']

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

webbox_path = "webbox" # e.g. /webbox
wb = WebBox(config['webbox'])

server = WebServer(config['server'], os.path.dirname(__file__))
server.add_webbox(wb, webbox_path)
server.run()

