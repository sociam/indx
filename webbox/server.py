#    This file is part of INDX.
#
#    Copyright 2012-2013 Daniel Alexander Smith, Max Van Kleek
#    Copyright 2012-2013 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with INDX.  If not, see <http://www.gnu.org/licenses/>.

import os, logging
from twisted.web import script
from twisted.web.resource import ForbiddenResource
from twisted.web.static import File
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred

import webbox.webserver.handlers as handlers
from webbox.webserver.handlers.box import BoxHandler
from webbox.webserver.handlers.app import AppsMetaHandler
from webbox.webserver import token
import webbox.webbox_pg2 as database

from webbox.webserver.handlers.websockets import WebSocketsHandler
from txWebSocket.websocket import WebSocketSite

BOX_NAME_BLACKLIST = [
    "admin",
    "html",
    "static",
    "lrdd",
    "webbox",
    ".well-known",
    "openid",
    "auth",
    "ws"
]


class WebServer:
    """ Twisted web server for running WebBox. """

    def __init__(self, config):
        """ Set up the server with a webbox. """

        self.tokens = token.TokenKeeper()
        self.config = config

        # enable ssl (or not)
        self.ssl = config['server'].get('ssl') or False

        # generate the base URLs
        self.server_url = self.config['server']['hostname']
        if not self.ssl:
            self.server_url = "http://" + self.server_url
            if self.config['server']['port'] != 80:
                self.server_url = self.server_url + ":" + str(self.config['server']['port'])
        else:
            self.server_url = "https://" + self.server_url
            if self.config['server']['port'] != 443:
                self.server_url = self.server_url + ":" + str(self.config['server']['port'])

        # get values to pass to web server
        self.server_address = self.config['server']['address']
        if self.server_address == "":
            self.server_address = "0.0.0.0"

        database.HOST = config['db']['host']
        database.PORT = config['db']['port']

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
        self.root = FileNoDirectoryListings(os.path.abspath(self.config['server']["html_dir"]))
        self.root.processors = {'.rpy': script.ResourceScript}
        self.root.ignoreExt('.rpy')
        
        # TODO: config rdflib some day
        # register("json-ld", Serializer, "rdfliblocal.jsonld", "JsonLDSerializer")

        ## initialize handlers
        [handler(self) for handler in handlers.HANDLERS]

        ## start boxes
        self.register_boxes(self.root)
        self.root.putChild('apps', AppsMetaHandler(self))        
        self.start()
        
        # load a web browser once the server has started
        def on_start(arg):
            logging.debug("Server started successfully.")
            try:
                if not self.config['no_browser']:
                    import webbrowser
                    webbrowser.open(self.server_url)
            except Exception as e:
                logging.debug("Couldn't load webbrowser: {0}".format(e))
        def start_failed(arg):
            logging.debug("start_failed: "+str(arg))

        # calls the web browser opening function above when the reactor has finished starting up
        d = Deferred()
        d.addCallbacks(on_start, start_failed)
        reactor.callWhenRunning(d.callback, "WebBox HTTP startup") #@UndefinedVariable
        reactor.addSystemEventTrigger("during", "shutdown", lambda *x: self.shutdown()) #@UndefinedVariable

    def shutdown(self):
        ## todo put more cleanup stuff here        
        logging.debug("Got reactor quit trigger, so closing down webbox.")
        self.tokens.close_all() # close all database connections
    
    def start(self):        
        factory = WebSocketSite(self.root)

        ## WebSockets is a Handler that is created for each request, so we add it differently here:
        factory.webserver = self;
        factory.addHandler('/ws', WebSocketsHandler)

        server_port = int(self.config['server']['port'])
        #server_hostname = self.config['server']['hostname']
        server_cert = self.config['server'].get('ssl_cert')
        server_private_key = self.config['server'].get('ssl_private_key')
        if not self.ssl:
            logging.debug("SSL is OFF, connections to this WebBox are not encrypted.")
            reactor.listenTCP(server_port, factory) #@UndefinedVariable
        else:
            logging.debug("SSL ON.")
            # pass certificate and private key into server
            sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
            reactor.listenSSL(server_port, factory, contextFactory=sslContext) #@UndefinedVariable

    def get_webbox_user_password(self):
        return self.config['db']['user'],self.config['db']['password']

    def get_master_box_list(self):
        ## returns _all_ boxes in this server
        user,password = self.get_webbox_user_password()
        return database.list_boxes(user,password)

    def register_boxes(self, parent):
        """ Add the webboxes to the server. """
        d = Deferred()
        def registerem(boxes):
            [self.register_box(boxname, parent) for boxname in boxes]
            d.callback(boxes)
        self.get_master_box_list().addCallback(registerem).addErrback(d.errback)

        
    def register_box(self, name, parent):
        """ Add a single webbox to the server. """
        parent.putChild(name, BoxHandler(self, name)) # e.g. /webbox

    def run(self):
        """ Run the server. """
        reactor.run() #@UndefinedVariable


