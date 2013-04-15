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
import os, logging, getpass, sys
from webbox.setup import WebBoxSetup
from webbox.server import WebServer

webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
setup = WebBoxSetup()
config = setup.setup("webbox.json.default") # directory, default config, kbname

# show debug messages in log file
formatter = logging.Formatter('%(name)s\t%(levelname)s\t%(asctime)s\t%(message)s')

log_handler = logging.FileHandler("/tmp/webbox.log", "a")
log_handler.setLevel(logging.DEBUG)
log_handler.setFormatter(formatter)

stdout_handler = logging.StreamHandler(stream=sys.stdout)
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.setFormatter(formatter)

logger = logging.getLogger() # root logger
logger.setLevel(logging.DEBUG)
for handler in logger.handlers: # remove default handler
    logger.removeHandler(handler)
logger.addHandler(log_handler) # add out new handlers with their specific formatting
logger.addHandler(stdout_handler)


server = WebServer(config, setup.get_config_filename(), os.path.dirname(__file__))
server.run()

