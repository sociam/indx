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

# setup the path for running sub processes
os.environ['PATH'] = os.path.join(os.path.dirname(__file__), "4store") + ":" + os.environ['PATH']
# the same for osx app version
os.environ['PATH'] = os.path.join(os.path.dirname(__file__), "..", "Resources", "4store") + ":" + os.environ['PATH']


# Initial Setup
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")

if not os.path.exists(webbox_dir): # no config for this user, set them up
    os.makedirs(webbox_dir)

data_dir = webbox_dir + os.sep + "data" # default data directory
if not os.path.exists(data_dir):
    os.makedirs(data_dir)

sub_dirs = ["logs", "files", "journals"] # subdirectories to data to make
for sub_dir in sub_dirs:
    sub_dir_path = data_dir + os.sep + sub_dir
    if not os.path.exists(sub_dir_path):
        os.makedirs(sub_dir_path)

# copy default localhost certificates
if not os.path.exists(data_dir+os.sep+'server.crt'):
    shutil.copyfile('data'+os.sep+'server.crt', data_dir+os.sep+'server.crt')
if not os.path.exists(data_dir+os.sep+'server.key'):
    shutil.copyfile('data'+os.sep+'server.key', data_dir+os.sep+'server.key')

# copy default config
webbox_config = webbox_dir + os.sep + "webbox.json"
if not os.path.exists(webbox_config):
    shutil.copyfile('webbox.json.default', webbox_config)

    # set up per user options in config
    conf_fh = open(webbox_config, "r")

    # load the json, parsing out comments manually
    comment_re = re.compile(r'#.*$')
    config_lines = ""
    for line in conf_fh.readlines():
        line = re.sub(comment_re, '', line)
        config_lines += line
    conf_fh.close()

    config = json.loads(config_lines)

    # add 4store kb based on username
    config['4store']['kbname'] = "webbox_" + getpass.getuser() # per user knowledge base

    # write updated config
    conf_fh = open(webbox_config, "w")
    json.dump(config, conf_fh)
    conf_fh.close()


# load configuration into 'config' variable
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


# add the webbox path to the config (at runtime only)
config['webbox_dir'] = webbox_dir




# twisted wsgi server modules

from twisted.internet import reactor
reactor.suggestThreadPoolSize(30)

from twisted.web import resource
from twisted.web.resource import ForbiddenResource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred


skip_logging = False # skip logging for improved performance

if not skip_logging:
    # set up logging to a file
    logdir = os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['log_dir'])
    logfile = os.path.join(logdir, config['webbox']['log'])

    # show debug messages in log
    log_handler = logging.FileHandler(logfile, "a")
    log_handler.setLevel(logging.DEBUG)

    logger = logging.getLogger() # root logger
    logger.addHandler(log_handler)
    logger.debug("Logger initialised")
    logger.setLevel(logging.DEBUG)

# run 4store 
from fourstoremgmt import FourStoreMgmt
fourstore = FourStoreMgmt(config['4store']['kbname'], http_port=config['4store']['port']) 
fourstore.start()


# use 4store query_store
from fourstore import FourStore
query_store = FourStore(config)

webbox_path = "webbox"

from webbox import WebBox
wb = WebBox("/"+webbox_path, query_store, config)

# WebBox WSGI handler
def webbox_wsgi(environ, start_response):
    logging.debug("WebBox WSGI response.")

    try:
        return [wb.response(environ, start_response)] # do not remove outer array [], it degrades transfer speed
    except Exception as e:
        logging.debug("Errorm returning 500: "+str(e))
        start_response("500 Internal Server Error", ())
        return []


# get values to pass to web server
server_address = config['webbox']['address']
if server_address == "":
    server_address = "0.0.0.0"
server_port = int(config['webbox']['port'])
server_hostname = config['webbox']['hostname']
server_cert = os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['ssl_cert'])
server_private_key =  os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['ssl_private_key'])

# TODO set up twisted to use gzip compression

# create a twisted web and WSGI server

# Disable directory listings
class FileNoDirectoryListings(File):
    def directoryListing(self):
        return ForbiddenResource()


# root handler is a static web server
resource = FileNoDirectoryListings(os.path.join(os.path.dirname(__file__), "html"))

# set up path handlers e.g. /webbox
resource.putChild(webbox_path, WSGIResource(reactor, reactor.getThreadPool(), webbox_wsgi))
factory = Site(resource)

# enable ssl (or not)
try:
    ssl_off = config['webbox']['ssl_off']
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
webbox_url = scheme+"://"+config['webbox']['hostname']+":"+config['webbox']['port']+"/"

# load a web browser once the server has started
def on_start(arg):
    print "on_start: "+str(arg)
    import webbrowser
    #webbrowser.open(config['webbox']['url'])
    webbrowser.open(webbox_url)
def start_failed(arg):
    print "start_failed: "+str(arg)

# start websockets server
from wsupdateserver import WSUpdateServer
wsupdate = WSUpdateServer() # TODO customize port / host


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

