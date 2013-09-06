#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

import os, logging, sys
from twisted.web import script
from twisted.web.resource import ForbiddenResource
from twisted.web.static import File
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred

import indx.webserver.handlers as handlers
from indx.webserver.handlers.box import BoxHandler
from indx.webserver.handlers.app import AppsMetaHandler
from indx.webserver import token
import indx.indx_pg2 as database

from indx.webserver.handlers.websockets import WebSocketsHandler
from txWebSocket.websocket import WebSocketSite

class WebServer:
    """ Twisted web server for running INDX. """

    def __init__(self, config):
        """ Set up the server with a INDX. """

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

        def auth_cb(can_auth):
            logging.debug("WebServer auth_cb, can_auth: {0}".format(can_auth))
            if can_auth:
                self.check_indx_db() # check indx DB exists, otherwise create it - then setup the server
            else:
                print "Authentication failed, check username and password are correct."
                reactor.stop()

        def err_cb(failure):
            logging.debug("WebServer err_cb, failure: {0}".format(failure))
            failure.trap(Exception)

        user,password = self.get_indx_user_password()
        self.database = database.IndxDatabase(config['indx_db'], user, password)
        self.database.auth_indx(database = "postgres").addCallbacks(auth_cb, err_cb)


    def check_indx_db(self):
        """ Check if the INDX database exists, otherwise create it. """
        logging.debug("WebServer check_indx_db")

        def success_cb(var):
            self.server_setup()

        def err_cb(failure):
            logging.debug("WebServer check_indx_db, err_cb, failure: {0}".format(failure))
            failure.trap(Exception)
            #reactor.stop()

        user,password = self.get_indx_user_password()
        self.database.check_indx_db().addCallbacks(success_cb, err_cb)


    def server_setup(self):
        """ Setup the web server. """
        # TODO set up twisted to use gzip compression



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
        self.appshandler = AppsMetaHandler(self)
        self.root.putChild('apps', self.appshandler)        
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
        reactor.callWhenRunning(d.callback, "INDX HTTP startup") #@UndefinedVariable
        reactor.addSystemEventTrigger("during", "shutdown", lambda *x: self.shutdown()) #@UndefinedVariable


    def shutdown(self):
        ## todo put more cleanup stuff here        
        logging.debug("Got reactor quit trigger, so closing down INDX.")
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
            logging.debug("SSL is OFF, connections to this INDX are not encrypted.")
            reactor.listenTCP(server_port, factory) #@UndefinedVariable
        else:
            logging.debug("SSL ON.")
            # pass certificate and private key into server
            sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
            reactor.listenSSL(server_port, factory, contextFactory=sslContext) #@UndefinedVariable

    def get_indx_user_password(self):
        return self.config['db']['user'],self.config['db']['password']

    def get_master_box_list(self):
        ## returns _all_ boxes in this server
        return self.database.list_boxes()

    def register_boxes(self, parent):
        """ Add the INDXes to the server. """
        d = Deferred()
        def registerem(boxes):
            [self.register_box(boxname, parent) for boxname in boxes]
            d.callback(boxes)
        self.get_master_box_list().addCallback(registerem).addErrback(d.errback)

        
    def register_box(self, name, parent):
        """ Add a single INDX to the server. """
        parent.putChild(name, BoxHandler(self, name)) # e.g. /indx

    def run(self):
        """ Run the server. """
        reactor.run() #@UndefinedVariable


