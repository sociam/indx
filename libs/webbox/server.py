#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
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

import os, logging, time, traceback, json, re
from urlparse import urlparse, parse_qs
from twisted.web import script
from twisted.internet import reactor
from twisted.web.resource import ForbiddenResource, Resource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File, Registry
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred

from webbox.exception import ResponseOverride
import webbox.webserver.handlers as handlers
from webbox.webserver.handlers.box import BoxHandler
from webbox.webserver import token
import webbox.webbox_pg2 as database

class WebServer:
    """ Twisted web server for running WebBox. """

    def __init__(self, config, config_filename, base_dir):
        """ Set up the server with a webbox. """

        self.tokens = token.TokenKeeper()
        self.config = config
        self.config_filename = config_filename

        # enable ssl (or not)
        try:
            ssl_off = config['server']['ssl_off']
        except Exception as e:
            ssl_off = False

        # generate the base URL
        self.server_url = config['server']['hostname']
        if ssl_off:
            self.server_url = "http://" + self.server_url
            if config['server']['port'] != 80:
                self.server_url = self.server_url + ":" + str(config['server']['port'])
        else:
            self.server_url = "https://" + self.server_url
            if config['server']['port'] != 443:
                self.server_url = self.server_url + ":" + str(config['server']['port'])

        # get values to pass to web server
        server_address = config['server']['address']
        if server_address == "":
            server_address = "0.0.0.0"
        server_port = int(config['server']['port'])
        server_hostname = config['server']['hostname']
        server_cert = os.path.join(base_dir,config['server']['ssl_cert'])
        server_private_key = os.path.join(base_dir,config['server']['ssl_private_key'])

        # TODO set up twisted to use gzip compression

        # set up the twisted web resource object
        # allow the config to be readable by .rpy files
        # registry = Registry()
        # registry.setComponent(WebBox, self.webbox)

        # Disable directory listings
        class FileNoDirectoryListings(File):
            def directoryListing(self):
                return ForbiddenResource()

        # root handler is a static web server
        root = FileNoDirectoryListings(os.path.abspath(config['server']["html_dir"]))
        root.processors = {'.rpy': script.ResourceScript}
        root.ignoreExt('.rpy')

        factory = Site(root)

        self.root = root

        # TODO: config rdflib first
        # register("json-ld", Serializer, "rdfliblocal.jsonld", "JsonLDSerializer")

        for handler in handlers.HANDLERS:
            handler(self)

        self.start_boxes()

        if ssl_off:
            logging.debug("SSL is OFF, connections to this WebBox are not encrypted.")
            reactor.listenTCP(server_port, factory) #@UndefinedVariable
        else:
            logging.debug("SSL ON.")
            # pass certificate and private key into server
            sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
            reactor.listenSSL(server_port, factory, contextFactory=sslContext) #@UndefinedVariable

        # load a web browser once the server has started
        def on_start(arg):
            logging.debug("Server started successfully.")
            try:
                if config['server']['load_browser']:
                    import webbrowser
                    webbrowser.open(self.server_url)
            except Exception as e:
                logging.debug("Couldnt load webbrowser.")
                
        def start_failed(arg):
            logging.debug("start_failed: "+str(arg))

        # calls the web browser opening function above when the reactor has finished starting up
        d = Deferred()
        d.addCallbacks(on_start, start_failed)
        reactor.callWhenRunning(d.callback, "WebBox HTTP startup") #@UndefinedVariable

        # setup triggers on quit
        def onShutDown():
            logging.debug("Got reactor quit trigger, so closing down webbox.")

        reactor.addSystemEventTrigger("during", "shutdown", onShutDown) #@UndefinedVariable

    def start_boxes(self):
        """ Add the webboxes to the server. """
        database.list_boxes(
            self.config['webbox']['db']['user'],
            self.config['webbox']['db']['password'])
        .addCallback(lambda boxes: [self.start_box(box) for box in boxes])

    def start_box(self, name):
        """ Add a single webbox to the server. """
        box = BoxHandler(self, name) # e.g. /webbox
        self.root.putChild(name, box); # e.g. /webbox

    def run(self):
        """ Run the server. """
        reactor.run() #@UndefinedVariable

    def invalid_name(self, name):
        """ Check if this name is safe (only contains a-z0-9_-). """ 
        return re.match("^[a-z0-9_-]*$", name) is None

    # @emax - how does this method relate to create_box in handlers/admin.py 
    def create_box(self, name):
        """ Create a new box, listening on /name. """

        # check name is valid        
        if self.invalid_name(name):
            raise ResponseOverride(403, "Forbidden")
    
        # can't be any of these, we already use them for things
        # @eMax - these should be loaded dynamically from the handlers
        blacklist = [
            "admin",
            "html",
            "static",
            "lrdd",
            "webbox",
            ".well-known",
            "openid",
            "auth"
        ]
        if name in blacklist:
            raise ResponseOverride(403, "Forbidden")
        
        # already exists?
        if name in self.config['webboxes']:
            raise ResponseOverride(403, "Forbidden")

        ## wat is this?
        self.config['webboxes'].append(name)
        self.save_config()
        self.start_box(name)

    def save_config(self):
        """ Save the current configuration to disk. """
        conf_fh = open(self.config_filename, "w")
        json.dump(self.config, conf_fh, indent=4)
        conf_fh.close()

