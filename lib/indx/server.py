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

import os
import logging
import getpass
from twisted.web import script
from twisted.web.resource import ForbiddenResource
from twisted.web.static import File
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from twisted.web.server import Session

import indx.webserver.handlers as handlers
from indx.webserver.handlers.box import BoxHandler
from indx.webserver.handlers.app import AppsMetaHandler
from indx.webserver import token
import indx.indx_pg2 as database
from indx.sync import IndxSync
from indx.keystore import IndxKeystore

from indx.webserver.handlers.websockets import WebSocketsHandler
from txWebSocket.websocket import WebSocketSite
from indx.reactor import IndxReactor
from indx.reactor import IndxWebHandler

class WebServer:
    """ Twisted web server for running INDX. """

    def __init__(self, config):
        """ Set up the server with a INDX. """

        self.config = config

        from twisted.internet.defer import setDebugging
        setDebugging(True)


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

                def checked_db_ok(server_id):
                    self.server_id = server_id # Gets the Server ID from the database
                    self.check_users().addCallbacks(lambda checked: self.server_setup(), err_cb)

                self.database.check_indx_db().addCallbacks(checked_db_ok, err_cb) # check indx DB exists, otherwise create it - then setup the server
            else:
                print "Authentication failed, check username and password are correct."
                reactor.stop()

        def auth_err(failure):
            logging.debug("WebServer err_cb, failure: {0}".format(failure))
            failure.trap(Exception)

            print "Authentication failed, check username and password are correct."
            reactor.stop()

        def err_cb(failure):
            logging.debug("WebServer err_cb, failure: {0}".format(failure))
            failure.trap(Exception)

        user,password = self.get_indx_user_password()
        self.database = database.IndxDatabase(config['indx_db'], user, password)
        self.tokens = token.TokenKeeper(self.database)
        self.indx_reactor = IndxReactor(self.tokens)
        self.database.set_reactor(self.indx_reactor) # ughh
        self.database.auth_indx(database = "postgres").addCallbacks(auth_cb, auth_err)


    def check_users(self):
        """ Check that there is at least one user, otherwise prompt the user to create one on the command-line. """
        logging.debug("WebServer check_users")
        result_d = Deferred()

        INDX_USERNAME = "@indx"

        def got_indx_cb(indx_conn):
            logging.debug("check_users, got_indx_cb")

            self.keystore = IndxKeystore(indx_conn)

            def got_users(users):
                logging.debug("check_users, got: {0}".format(users))

                create_owner_user = len(users) < 1 # if there are no users yet, we will create an owner user on the command line

                indx_user_exists = False
                for user in users:
                    if user["@id"] == INDX_USERNAME:
                        indx_user_exists = True

                def user_len_check(empty):
                    """ Now create the owner user if we need to. """

                    def check_encryption_keys(empty):
                        """ Now check that each user has a key pair, and create ones for those that do not. """
                        self.database.missing_key_check().addCallbacks(result_d.callback, result_d.errback)

                    if create_owner_user:
                        logging.debug("No users - prompting user on the command-line now.")
                        print "There are no users in the system, please create an owner user now."
                        new_username = ""
                        while len(new_username) == 0:
                            new_username = raw_input("Username: ")
                        new_password = ""
                        while len(new_password) == 0:
                            new_password = getpass.getpass("Password: ")

                        self.database.create_user(new_username, new_password, 'local_owner').addCallbacks(check_encryption_keys, result_d.errback)
                    else:
                        check_encryption_keys(None)


                if not indx_user_exists:
                    # create the @indx user now
                    self.database.create_user(INDX_USERNAME, "", "internal").addCallbacks(user_len_check, result_d.errback)
                else:
                    user_len_check(None)
                    

            self.database.list_users().addCallbacks(got_users, result_d.errback)

        self.database.connect_indx_db().addCallbacks(got_indx_cb, result_d.errback)

        return result_d


    def server_setup(self):
        """ Setup the web server. """
        # TODO set up twisted to use gzip compression


        # Disable directory listings
        class FileNoDirectoryListings(File):
            def directoryListing(self):
                return ForbiddenResource()
        # root handler is a static web server
        self.root = FileNoDirectoryListings(os.path.abspath(self.config['server']["html_dir"]))
        #self.root.processors = {'.rpy': script.ResourceScript}
        #self.root.ignoreExt('.rpy')
        
        # TODO: config rdflib some day
        # register("json-ld", Serializer, "rdfliblocal.jsonld", "JsonLDSerializer")

        ## initialize handlers
        [handler(self) for handler in handlers.HANDLERS]

        ## start boxes
        self.register_boxes(self.root)

        ## XXX TODO temporaily remove for debugging
        self.appshandler = AppsMetaHandler(self)
        self.root.putChild('apps', self.appshandler)        


        self.start()
        
        # load a web browser once the server has started
        def on_start(arg):
            logging.debug("Server started successfully.")
            try:
                reactor.callInThread(lambda empty: self.start_syncing(), None) # separately do indx syncing in a twisted thread
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

    def sync_box(self, root_box):
        """ Start syncing the named box. """
        logging.debug("WebServer, sync_box for root_box {0}".format(root_box))
        return_d = Deferred()

        if root_box in self.syncs:
            logging.error("sync_box: returning from cache")
            indxsync = self.syncs[root_box]
            return_d.callback(indxsync)
        else:
            def err_cb(failure):
                logging.error("WebServer, sync_box error getting token: {0} {1}".format(failure, failure.value))
                # FIXME do something with the error?
                return_d.errback(failure)

            self.syncs[root_box] = None # reserve the slot

            def store_cb(root_store):
                indxsync = IndxSync(root_store, self.database, self.server_url, self.keystore, self)
                self.syncs[root_box] = indxsync
                return_d.callback(indxsync)

            # assign ourselves a new token to access the root box using the @indx user
            # this only works because the "create_root_box" function gave this user read permission
            # this doesn't work in the general case.
            def token_cb(token):
                token.get_store().addCallbacks(store_cb, err_cb)

            self.tokens.new("@indx","",root_box,"IndxSync","/","::1", self.server_id).addCallbacks(token_cb, return_d.errback)

        return return_d 

    def start_syncing(self):
        """ Start IndxSyncing root boxes. (after indx is up and running) """
        logging.debug("WebServer start_syncing")

        self.syncs = {}

        def err_cb(failure):
            logging.error("WebServer, start_syncing error getting root boxes: {0} {1}".format(failure, failure.value))
            # FIXME do something with the error?

        def linked_boxes_cb(rows):
            logging.debug("WebServer start_syncing linked_boxes_cb")
            for row in rows:
                linked_box = row[0]
                logging.debug("WebServer start_syncing linked box: {0}".format(linked_box))

                def sync_a_box():
                    
                    def sync_cb(indxsync):
                        indxsync.sync_boxes().addCallbacks(lambda empty: logging.debug("Sucessfully called sync in webserver."), lambda failure: logging.error("Failure syncing in webserver."))

                    self.sync_box(linked_box).addCallbacks(sync_cb, lambda failure: logging.error("Failure syncing in webserver."))

                reactor.callInThread(lambda empty: sync_a_box(), None)

        self.database.get_linked_boxes().addCallbacks(linked_boxes_cb, err_cb)


    def shutdown(self):
        ## todo put more cleanup stuff here        
        logging.debug("Got reactor quit trigger, so closing down INDX.")
        self.tokens.close_all() # close all database connections
    
    def start(self):        
        factory = WebSocketSite(self.root)

        class LongSession(Session):
            sessionTimeout = 60 * 60 * 6 # = 6 hours (value is in seconds - default is 15 minutes)

        factory.sessionFactory = LongSession

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
        #parent.putChild(name, BoxHandler(self, name)) # e.g. /indx

        # register a generic web handler with the twisted web server
        parent.putChild(name, IndxWebHandler(self.indx_reactor, name))

        box_handler = BoxHandler(self, base_path = name)
        # register the handler with the indx reactor
        for mapping in box_handler.get_mappings():
            self.indx_reactor.add_mapping(mapping)


    def run(self, reactor_start = True):
        """ Run the server. """
        if reactor_start:
            reactor.run() #@UndefinedVariable


