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
from twisted.internet import reactor
from twisted.web import resource
from twisted.web.resource import ForbiddenResource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred
from fourstoremgmt import FourStoreMgmt
from fourstore import FourStore
from webbox import WebBox
from wsupdateserver import WSUpdateServer


# Initial Setup
kbname = "webbox_" + getpass.getuser() # per user knowledge base
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
setup = WebBoxSetup()
setup.setup(webbox_dir, "webbox.json.default", "data", kbname) # directory, default config, default certification dir, kbname


# load configuration into 'config' variable
webbox_config = webbox_dir + os.sep + "webbox.json"
conf_fh = open(webbox_config, "r")
config = json.loads(conf_fh.read())
conf_fh.close()

# add the webbox path to the config (at runtime only)
config['webbox']['webbox_dir'] = webbox_dir

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

# run 4store 
fourstore = FourStoreMgmt(config['4store']['kbname'], http_port=config['4store']['port']) 
fourstore.start()


# use 4store query_store
query_store = FourStore(config['4store']['host'], config['4store']['port'])

webbox_path = "webbox" # e.g. /webbox
wb = WebBox("/"+webbox_path, query_store, config['webbox'])


# get values to pass to web server
server_address = config['server']['address']
if server_address == "":
    server_address = "0.0.0.0"
server_port = int(config['server']['port'])
server_hostname = config['server']['hostname']
server_cert = os.path.join(os.path.dirname(__file__),config['server']['ssl_cert'])
server_private_key = os.path.join(os.path.dirname(__file__),config['server']['ssl_private_key'])

# TODO set up twisted to use gzip compression

# create a twisted web and WSGI server

# Disable directory listings
class FileNoDirectoryListings(File):
    def directoryListing(self):
        return ForbiddenResource()

# root handler is a static web server
resource = FileNoDirectoryListings(os.path.join(os.path.dirname(__file__), "html"))

# set up path handlers e.g. /webbox
resource.putChild(webbox_path, WSGIResource(reactor, reactor.getThreadPool(), wb.response))
factory = Site(resource)

# enable ssl (or not)
try:
    ssl_off = config['server']['ssl_off']
    ssl_off = (ssl_off == "true")
except Exception as e:
    ssl_off = False

if ssl_off:
    logging.debug("SSL is OFF, connections to this SecureStore are not encrypted.")
    reactor.listenTCP(server_port, factory)
else:
    logging.debug("SSL ON.")
    # pass certificate and private key into server
    sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
    reactor.listenSSL(server_port, factory, contextFactory=sslContext)

scheme = "https"
if ssl_off:
    scheme = "http"
server_url = scheme+"://"+server_hostname+":"+str(server_port)+"/"

# load a web browser once the server has started
def on_start(arg):
    logging.debug("Server started successfully.")
    if config['server']['load_browser']:
        import webbrowser
        webbrowser.open(server_url)
def start_failed(arg):
    logging.debug("start_failed: "+str(arg))

# start websockets server
wsupdate = WSUpdateServer(port=8214, host="localhost") # TODO customize port / host


# calls the web browser opening function above when the reactor has finished starting up
d = Deferred()
d.addCallbacks(on_start, start_failed)
reactor.callWhenRunning(d.callback, "WebBox HTTP startup")

# setup triggers on quit
def onShutDown():
    logging.debug("Got reactor quit trigger, so closing down fourstore.")
    fourstore.stop()

reactor.addSystemEventTrigger("during", "shutdown", onShutDown)

# run the twisted server
reactor.run()

