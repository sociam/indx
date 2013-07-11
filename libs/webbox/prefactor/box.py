#    This file is part of INDX.
#
#    Copyright 2011-2013 Daniel Alexander Smith
#    Copyright 2011-2013 University of Southampton
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
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


import logging, urllib2, uuid, rdflib, os, traceback, mimetypes, shutil, json
import psycopg2
from time import strftime
from urlparse import urlparse, parse_qs
from rdflib.serializer import Serializer
from rdflib.plugin import register
from rdflib.graph import Graph
import rdfliblocal.jsonld

from twisted.web.resource import Resource

from subscriptions import Subscriptions
from journal import Journal
from httputils import resolve_uri
from exception import ResponseOverride

from webbox.webserver.session import WebBoxSession, ISession
from webbox.webserver.wsupdateserver import WSUpdateServer
from webbox.webserver.websocketclient import WebSocketClient
from webbox.objectstore_async import ObjectStoreASync, RDFObjectStore, IncorrectPreviousVersionException

class WebBox:
    # to use like WebBox.to_predicate
    webbox_ns = "http://webbox.ecs.soton.ac.uk/ns#"

    to_predicate = "http://rdfs.org/sioc/ns#addressed_to"
    address_predicate = webbox_ns + "address"
    files_graph = webbox_ns + "UploadedFiles" # the graph with metadata about files (non-RDF)
    subscribe_predicate = webbox_ns + "subscribe_to" # uri for subscribing to a resource
    unsubscribe_predicate = webbox_ns + "unsubscribe_from" # uri for unsubscribing from a resource
    received_graph = webbox_ns + "ReceivedGraph" # default URI for store inbox

    def __init__(self, config, server_url):
        self.config = config # configuration from server

        self.server_url = server_url
        logging.debug("Started new WebBox at URL: " + self.server_url)

        # connect to the object store (database)
        self.reconnect_object_store()
        
        self.file_dir = os.path.join(config['webbox_dir'],config['file_dir'])
        self.file_dir = os.path.realpath(self.file_dir) # where to store PUT files

        # @todo move to the webserver ? 
        # start websockets server
        self.wsupdate = WSUpdateServer(port=config['ws_port'], host=config['ws_hostname'])
        self.websocket = WebSocketClient(host=config['ws_hostname'],port=config['ws_port'])


    def get_html_index(self):
        """ Which mustache template to use for the webbox root index. Changes from 'index' when there is a critical configuration issue to resolve. """
        
        if self.object_store is None:
            return "init_object_store"

        return "index"

    def initialise_object_store(self, root_user, root_pass):
        """ Attempt to create a webbox user and a database using the credentials passed in. """

        if self.object_store is not None:
            # don't do anything here
            return

        # create the new database
        ObjectStoreAsync.initialise(self.config['db']['name'], root_user, root_pass, self.config['db']['user'], self.config['db']['password'])

        # now it's all set up, we can reconnect it
        if self.object_store is None:
            self.reconnect_object_store()

    def reconnect_object_store(self):
        """ Try to reconnect to the object store using the username/password/db in self.config['webbox']['db'].
            This is done when the configuration has changed at runtime (e.g. when the user has given the database details when they first init their webbox.
        """

        try:
            # create postgres connection
            self.objectstore_db_conn = psycopg2.connect(database = self.config['db']['name'],
                                         user = self.config['db']['user'],
                                         password = self.config['db']['password'])
            self.object_store = ObjectStoreAsync(self.objectstore_db_conn)
            self.query_store = RDFObjectStore(self.object_store) # handles RDF to object conversion
        except Exception as e:
            logging.debug("Exception reconnecting object store, setting to None. Exception: {0}".format(str(e)))
            self.object_store = None

    def get_base_url(self):
        """ Get the server URL without the /webbox suffix. """
        return self.server_url

    def stop(self):
        """ Shut down the web box. """
        pass

    def add_to_journal(self, graphuri):
        """ This Graph URI was added or changed, add to the journal. """

        logging.debug("Journal updating on graph: "+graphuri)

        repository_hash = uuid.uuid1().hex # TODO in future, make this a hash instead of a uuid

        journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
        journal.add(repository_hash, [graphuri])

        self.update_websocket_clients()

    ## @todo - update this to use postgres instead of sqlite, and split out
    ## websocket logic into webserver (which deals with clients), and
    ## journal subscriber logic which stays here        
    def update_websocket_clients(self):
        """ There has been an update to the webbox store, so send the changes to the clients connected via websocket. """
        logging.debug("Updating websocket clients...")

        try:

            journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
            hashes = journal.get_version_hashes()
            if "previous" in hashes:
                previous = hashes["previous"]
                
                uris_changed = journal.since(previous)
                logging.debug("URIs changed: %s" % str(uris_changed))

                if len(uris_changed) > 0:

                    ntrips = ""
                    for uri in uris_changed:
                        query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
                        logging.debug("Sending query for triples as: %s " % query)

                        result = self.query_store.query(query, {"Accept": "text/plain"})
                        # graceful fail per U

                        rdf = result['data']
                        ntrips += rdf + "\n"

                    self.websocket.sendMessage(ntrips, False)
        except Exception as e:
            logging.error("Problem updating websocket clients: {0}".format(str(e)))

    # @todo - this needs to get pushed into postgres
    def get_subscriptions(self):
        """ Get a new subscriptions object, used by this class and also the webbox handler. """
        filename = os.path.join(self.config['webbox_dir'],self.config['subscriptions'])
        return Subscriptions(filename)

    # 
    def updated_resource(self, uri, type):
        """ Handle an update to a resource and send out updates to subcribers. """
        # type is "rdf" or "file"

        logging.debug("resource [%s] updated, notify subscribers" % uri)

        subscriptions = self.get_subscriptions()
        subscribers = subscriptions.get_subscribers(uri)
        logging.debug("subscribers are: %s" % str(subscribers))

        for subscriber in subscribers:
            try:
                status = self.send_message(subscriber, uri)
                if status is True:
                    logging.debug("notified %s about %s" % (subscriber, uri))
                else:
                    logging.debug("could not notify %s about %s: error was: %s" % (subscriber, uri, status))
            except Exception as e:
                logging.debug("error notifying subscriber (%s): %s, moving on." % (str(e), subscriber))

        return None # success



        
    # @todo - update from SPARQL to querying the store
    def _get_webbox(self, person_uri):
        """ Get the WebBox of a person, based on their URI. """

        query = "SELECT DISTINCT ?webbox WHERE { <%s> <%s> ?webbox } " % (person_uri, WebBox.address_predicate)
        response = self.query_store.query(query)
        if response['status'] >= 200 and response['status'] <= 299:
            results = response['data']
            for row in results:
                webbox = row['webbox']['value']
                logging.debug("found webbox uri: "+webbox)
                return webbox
        else:
            logging.error("Couldn't get webbox of person with uri %s, response: %s" % (person_uri, str(response)))
        
        return None

    # resolves your URI to get back your FOAF file and would look up
    # your webbox address if it was in there.    
    def get_webbox(self, person_uri):
        """ Get the webbox URL of a person's URI. """

        # check your store to see we already know your webbox address
        logging.debug("looking up webbox URI of person: "+person_uri)
        response = self._get_webbox(person_uri)

        if response is not None:
            return response
        
        # did not have it in the local store, resolve it instead:
        try:
            rdf = resolve_uri(person_uri)
        except Exception as e:
            logging.debug("Did not resolve webbox from the person's (FOAF) URI: "+person_uri+", exception e: "+str(e)+", trace: "+traceback.format_exc())
            return None

        logging.debug("resolved it.")

        # put into store 
        # put resolved URI into the store
        # put into its own graph URI in store
        response = self.SPARQLPut(person_uri, rdf, "application/rdf+xml")
        logging.debug("Put it in the store: "+str(response))

        if response['status'] > 299:
            logging.debug("! error putting person uri into local store. status is: %s " % str(response))
            return None

        # TODO notify apps etc.
        logging.debug("Received message of URI, and put it in store: " + person_uri)


        logging.debug("looking up webbox URI of person: "+person_uri)
        response = self._get_webbox(person_uri)

        if response is not None:
            return response


        logging.debug("did not find webbox uri.")
        return None


    # SHARING --
    def send_message(self, recipient_uri, message_resource_uri):
        """ Send an external message to a recipient. """

        # URI to HTTP POST to
        webbox_uri = self.get_webbox(recipient_uri)
        if webbox_uri is None:
            logging.debug("Could not get webbox of " + recipient_uri)
            return "Couldn't get webbox of: " + recipient_uri

        # generate our RDF message to "POST"
        graph = Graph()
        graph.add(
            (rdflib.URIRef(message_resource_uri),
             rdflib.URIRef(WebBox.to_predicate),
             rdflib.URIRef(recipient_uri)))
        
        rdf = graph.serialize(format="xml") # rdf/xml

        req_uri = webbox_uri
        try:
            # HTTP POST to their webbox
            opener = urllib2.build_opener(urllib2.HTTPHandler)
            request = urllib2.Request(req_uri, data=rdf)
            request.add_header('Content-Type', 'application/rdf+xml') # because format="xml" above
            request.get_method = lambda: 'POST'
            url = opener.open(request)
            return True
        except Exception as e:
            """ Couldn't send a message fast-fail. """
            logging.debug("Couldn't send a message to: " + req_uri)
            return "Couldn't connect to %s" % req_uri

    def add_new_file(self, filename, mimetype=None):
        """ Add a new file to the files graph (it was just updated/uploaded). """
        logging.debug("Adding a new file metadata to the store for file: "+filename)

        uri = self.server_url + os.sep + filename

        # create the RDF
        graph = None
        while graph is None:
            try:
                graph = Graph()
            except Exception as e:
                logging.debug("Got error making graph ({0}), trying again.".format(str(e)))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
             rdflib.URIRef(self.webbox_ns + "File")))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef(self.webbox_ns+"filename"),
             rdflib.Literal(filename)))

        if mimetype is None:
            mimetype = mimetypes.guess_type(filename)[0]

        if mimetype is not None:
            graph.add(
                (rdflib.URIRef(uri),
                 rdflib.URIRef("http://www.semanticdesktop.org/ontologies/nie/#mimeType"),
                 rdflib.Literal(mimetype)))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://www.w3.org/2000/01/rdf-schema#label"),
             rdflib.URIRef(uri)))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://purl.org/dc/terms/created"),
             rdflib.Literal(strftime("%Y-%m-%dT%H:%M:%SZ")))) # FIXME forces zulu time, which may be technically incorrect
        
        rdf = graph.serialize(format="xml") # rdf/xml

        status = self.SPARQLPost(self.files_graph, rdf, "application/rdf+xml")

        logging.debug("Put a webbox:File in the store: "+str(status))

        if status['status'] > 299:
            logging.debug("Put failed: "+str(status))
            return False

        self.add_to_journal(self.files_graph)

        return True



    def SPARQLPut(self, graph, file, content_type):
        """ Handle a SPARQL PUT request. 'graph' is for store, 'filename' is for RWW. """

        # send file to query store
        logging.debug("replacing graph %s with rdf" % graph)
        response1 = self.query_store.put_rdf(file, content_type)

        return response1


    def SPARQLPost(self, graph, file, content_type):
        """ Handle a SPARQL POST (append) request. 'graph' is for store, 'filename' is for RWW. """

        # send file to query store (store)
        logging.debug("POST to query store.")
        response1 = self.query_store.post_rdf(file, content_type)

        return response1

    def get_file_path(self, req_path):
        """ Get the file path on disk specified by the request path, or exception if there has been a (security etc.) issue. """

        file_path = os.path.abspath(self.file_dir + os.sep + req_path)

        if not self.check_file_path(file_path):
            raise ResponseOverride(403, "Forbidden")

        return file_path


    def check_file_path(self, path):
        """ Check that a path doesn't contain any references to parent path. """

        # check that the path is within our file directory
        abs_file_path = os.path.abspath(self.file_dir)
        abs_this_path = os.path.abspath(path)

        return abs_this_path.startswith(abs_file_path)

