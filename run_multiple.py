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

import sys, os, logging, json
from webboxmulti import WebBoxMulti

config = {
    "bindirs": [
        "4store", # add the 4store/ directory to the environment path (remove this under linux)
        "../Resources/4store" # for the OSX .app
    ],
    "log": "/tmp/webbox_multi.log",
    "htdigest": "htpasswd", # file with global htdigest authentication for server
    "management": {
        "host": "localhost",
        "port": 8210,
        "srcdir": "multimgmt",
        "basedir": os.path.dirname(__file__),
        "ssl_cert": "data/server.crt",
        "ssl_key": "data/server.key",
    },
    "url_scheme": "https",
    "webboxes": [
        {
            "directory": "daniel",
            "status": "stopped",
            "config": {
                # webbox configuration
                "webbox_dir": "/Users/das05r/.webbox",
                "ws_hostname": "localhost",
                "ws_port": 8214,

                # sqlite dbs
                "subscriptions": "subscriptions.sqlite", # subscription filename
                "journal": "journal.sqlite", # journal filename

                # subdirectories
                "file_dir": "files", # relative to webbox dir

                "url": "https://localhost:8210/daniel/webbox", # how the webbox sees itself (used to check owner in RDF)

                # 4store configuration
                "4store": {
                    "host": "localhost",
                    "port": 8212,
                    "kbname": "webbox_das05r",
                }, 
            },
        },
    ],
}

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

