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


import logging, re, urllib2, uuid, rdflib, os, os.path, traceback

from rdflib.graph import Graph
from cStringIO import StringIO
from time import strftime
from urlparse import urlparse
from webboxhandler import WebBoxHandler
from subscriptions import Subscriptions
from journal import Journal
from websocketclient import WebSocketClient
from mimeparse import best_match

from rdflib.serializer import Serializer
from rdflib.plugin import register
import rdflib.plugins.serializers.jsonld

class WebBox:
    # to use like WebBox.to_predicate
    webbox_ns = "http://webbox.ecs.soton.ac.uk/ns#"

    to_predicate = "http://rdfs.org/sioc/ns#addressed_to"
    address_predicate = webbox_ns + "address"
    message_uri_prefix = webbox_ns + "post-" # The URI prefix of the sioc:Post resources we make
    sioc_graph = webbox_ns + "ReceivedSIOCGraph" # the graph for received messages as sioc:Posts
    subscribe_predicate = webbox_ns + "subscribe_to" # uri for subscribing to a resource
    unsubscribe_predicate = webbox_ns + "unsubscribe_from" # uri for unsubscribing from a resource
    
    def __init__(self, server_url, path, req_type, req_path, req_qs, environ, proxy, file_dir, config):
        self.graph = "http://webbox.ecs.soton.ac.uk/ns#ReceivedGraph" # the default graph URI for 4store

        self.subscriptions = Subscriptions(server_url, config)

        self.server_url = server_url # base url of the server, e.g. http://localhost:8212
        self.path = path # the path this module is associated with, e.g. /webbox
        self.proxy = proxy # a configured SecureStoreProxy instance
        self.file_dir = os.path.realpath(file_dir) # where to store PUT files
        self.config = config # configuration from server

        self.webbox_url = self.server_url + self.path # e.g. http://localhost:8212/webbox - used to ref in the RDF

        logging.debug("Started new WebBox at URL: " + self.webbox_url)

        self.environ = environ # the environment (from WSGI) of the request (i.e., as in apache)
        self.req_path = req_path # the path of the request e.g. /webbox/file.rdf
        self.req_qs = req_qs # the query string of the request as a dict with array elements, e.g. {'q': ['foo']} is ?q=foo
        self.req_type = req_type # the type of query, e.g. the HTTP operation, GET/PUT/POST

        logging.debug("new instance of webbox with path %s, query string %s and type %s" % (self.req_path, str(self.req_qs), self.req_type))

        # config rdflib first
        register("json-ld", Serializer, "rdflib.plugins.serializers.jsonld", "JsonLDSerializer")

        self.rdf_formats = {
            "application/rdf+xml": "xml",
            "application/n3": "n3",
            "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
            "text/plain": "nt",
            "application/json": "json-ld",
            "text/json": "json-ld",
        }

        #self.journal = Journal(self.uri2path(server_url))
        self.journal = Journal(os.path.join(config['webbox_dir'],config['webbox']['data_dir'],config['webbox']['journal_dir']), config['webbox']['journalid'])
        self.websocket = WebSocketClient(host="localhost",port=8214) #TODO from config file
            

    def response(self, rfile):
        if self.req_type == "POST":
            return self.do_POST(rfile)
        elif self.req_type == "PUT":
            return self.do_PUT(rfile)
        else:
            return self.do_GET()

    def add_to_journal(self, graphuri):
        """ This Graph URI was added or changed, add to the journal. """

        repository_hash = uuid.uuid1().hex # TODO in future, make this a hash instead of a uuid
        self.journal.add(repository_hash, [graphuri])

        self.update_websocket_clients()

    def update_websocket_clients(self):
        """ There has been an update to the webbox store, so send the changes to the clients connected via websocket. """
        logging.debug("Updating websocket clients...")

        hashes = self.journal.get_version_hashes()
        if "previous" in hashes:
            previous = hashes["previous"]
            
            uris_changed = self.journal.since(previous)
            logging.debug("URIs changed: %s" % str(uris_changed))

            if len(uris_changed) > 0:

                ntrips = ""
                for uri in uris_changed:
                    query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
                    logging.debug("Sending query for triples as: %s " % query)

                    result = self.proxy.query_store.query(query, {"Accept": "text/plain"})
                    # graceful fail per U

                    rdf = result['data']
                    ntrips += rdf + "\n"

                self.websocket.sendMessage(ntrips, False)


    def updated_resource(self, uri, type):
        """ Handle an update to a resource and send out updates to subcribers. """

        # type is "rdf" or "file"

        logging.debug("resource [%s] updated, notify subscribers" % uri)

        subscribers = self.subscriptions.get_subscribers(uri)
        logging.debug("subscribers are: %s" % str(subscribers))

        for subscriber in subscribers:
            try:
                status = self.send_message(subscriber, uri)
                if status is True:
                    logging.debug("notified %s about %s" % (subscriber, uri))
                else:
                    logging.debug("could not notify %s about %s: error was: %s" % (subscriber, uri, status))
            except Exception as e:
                logging.debug("error notifying subscriber: %s, moving on." % subscriber)

        return None # success

    def do_POST(self, rfile):
        """ Handle a POST (update). """

        post_uri = self.server_url + self.req_path
        logging.debug("POST of uri: %s" % post_uri)


        # TODO check for hackery properly, i.e. os.chroot
        if ".." in self.req_path:
            return {"data": ".. not allowed in path", "status": 500}

        file_path = self.file_dir + os.sep +self.req_path

        logging.debug("self.file_dir: %s, self.req_path: %s" % (self.file_dir, self.req_path))
        logging.debug("file path is: %s" % file_path)

        if self.environ.has_key("CONTENT_TYPE"):
            content_type = self.environ['CONTENT_TYPE']

        if content_type in self.rdf_formats:
            logging.debug("content type of PUT is RDF so we send to RWW.")
            # not a file, send to RWW to deal with
            # TODO remove redundancy from here (this code is copied from do_PUT)

            rdf_format = self.rdf_formats[content_type]

            size = 0
            if self.environ.has_key("CONTENT_LENGTH"):
                size = int(self.environ['CONTENT_LENGTH'])

            file = ""
            if size > 0:
                # read into file
                file = rfile.read(size)
            
            # deserialise rdf into triples
            graph = Graph()
            graph.parse(StringIO(file), format=rdf_format) # format = xml, n3 etc

            # check for webbox specific messages
            handle_response = self._handle_webbox_rdf(graph) # check if rdf contains webbox-specific rdf, i.e. to_address, subscribe etc
            if handle_response is not None:
                return handle_response # i.e., there is an error, so return it


            # prepare the arguments for local PUTing of this data
            graph = self.graph
            if self.req_qs.has_key('graph'):
                graph = self.req_qs['graph'][0]
                path = self.uri2path(graph)
            else:
                path = self.req_path

            # do SPARQL PUT
            logging.debug("WebBox SPARQL POST to graph (%s)" % (graph) )

            status = self.proxy.SPARQLPost(graph, path, file, content_type)
            if status > 299:
                return {"data": "Unsuccessful.", "status": status}


            self.updated_resource(post_uri, "rdf") # notify subscribers
            self.add_to_journal(graph)
            return {"data": "Successful.", "status": 200}

        else:
            logging.debug("a POST of a file")
            # Not RDF content type, so lets treat as a file upload
            exists = os.path.exists(file_path)

            if not exists:
                return {"data": "File does not exist, use PUT to create a new file.", "status": 404}

            logging.debug("file existed, so we're removing it, and then calling a PUT internally")
            os.remove(file_path)
            put_response = self.do_PUT(rfile)
            if put_response['status'] == 201:
                self.updated_resource(post_uri, "file") # notify subscribers
                return {"data": "Updated", "status": 200}
            else:
                return put_response
        # never reach here

    def handle_update(self):
        if "since" in self.req_qs:
            # get the triples of all changed URIs since this repository URI version
            since_repository_hash = self.req_qs['since'][0]
        else:
            since_repository_hash = None


        uris_changed = self.journal.since(since_repository_hash)
        logging.debug("URIs changed: %s" % str(uris_changed))

        if len(uris_changed) > 0:

            ntrips = ""
            for uri in uris_changed:
                query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
                logging.debug("Sending query for triples as: %s " % query)

                result = self.proxy.query_store.query(query, {"Accept": "text/plain"})
                # graceful fail per U

                rdf = result['data']
                ntrips += rdf + "\n"

            # TODO conneg
            rdf_type = "text/plain" # text/plain is n-triples (really)

            return {"data": ntrips, "status": 200, "type": rdf_type}

        else:
            # no update
            logging.debug("Client is up to date")
            return {"data": "", "status": 204}



    def do_GET(self):

        logging.debug("path: %s req_path: %s" % (self.path, self.req_path))

        # journal update called
        if self.req_path == self.path + "/update":
            return self.handle_update()


        if self.req_qs.has_key("query"):
            # SPARQL query because ?query= is present
            args = {'query': self.req_qs['query'][0]} # TODO support more? 

            logging.debug("sparql query, arg out is: "+str(args))
            response = self.proxy.SPARQLQuery(args)
        else:
            # is this a plain file that exists?
            # TODO check for hackery properly, i.e. os.chroot
            if ".." in self.req_path:
                return {"data": ".. not allowed in path", "status": 500}

            file_path = self.file_dir + os.sep + self.req_path
            if os.path.exists(file_path):
                # return the file
                f = open(file_path, "r")
                filedata = f.read()
                f.close()
                return {"data": filedata, "status": 200}
            else:
                # GET from RWW instead
                response = self.proxy.SPARQLGet(self.req_path)

        # convert based on headers
        response = self._convert_response(response)

        return response

    def _convert_response(self, response):
        if not (response['status'] == 200 or response['status'] == "200 OK"):
            logging.debug("Not converting data, status is not 200.")
            return response # only convert 200 OK responses

        status = response['status']
        type = response['type'].lower()
        data = response['data']

        accept = self.environ['HTTP_ACCEPT'].lower()

        if accept == type:
            logging.debug("Not converting data, type is identical to that requested.")
            return response

        # data
        new_mime = best_match(self.rdf_formats.keys(), accept)
        if new_mime in self.rdf_formats:
            old_format = self.rdf_formats[type]
            new_format = self.rdf_formats[new_mime]

            graph = Graph()
            graph.parse(StringIO(data), format=old_format) # format = xml, n3 etc

            # reserialise into new format
            new_data = graph.serialize(format=new_format) # format = xml, n3, nt, turtle etc
            new_response = {"status": status,
                            "type": new_mime,
                            "data": new_data}

            logging.debug("Returning converted response from "+type+" to "+accept+".")
            return new_response

        else:
            logging.debug("Can't understand Accept header of "+accept+", so returning data as-is.")
            return response
        

    def _get_webbox(self, person_uri):

        query = "SELECT DISTINCT ?webbox WHERE { <%s> <%s> ?webbox } " % (person_uri, WebBox.address_predicate)
        response = self.proxy.query_store.query(query)
        if response['status'] >= 200 and response['status'] <= 299:
            results = response['data']
            for row in results:
                webbox = row['webbox']['value']
                logging.debug("found webbox uri: "+webbox)
                return webbox
        else:
            logging.error("Couldn't get webbox of person with uri %s, response: %s" % (person_uri, str(response)))
        
        return None

    def get_webbox(self, person_uri):
        """ Get the webbox URL of a person's URI. """

        logging.debug("looking up webbox URI of person: "+person_uri)
        response = self._get_webbox(person_uri)

        if response is not None:
            return response
        
        # did not have it in the local store, resolve it instead:
        try:
            rdf = self.proxy.resolve_uri(person_uri)
        except Exception as e:
            logging.debug("Did not resolve webbox from the person's (FOAF) URI: "+person_uri)
            return None

        logging.debug("resolved it.")

        # put into 4store and RWW
        # put resolved URI into the store
        # put into its own graph URI in 4store
        # TODO is uri2path the best thing here? or GUID it maybe?
        status = self.proxy.SPARQLPut(person_uri, self.uri2path(person_uri), rdf, "application/rdf+xml")
        logging.debug("Put it in the store: "+str(status))

        if status > 299:
            logging.debug("! error putting person uri into local store. status is: %s " % str(status))
            return None

        # TODO notify apps etc.
        logging.debug("Received message of URI, and put it in store: " + person_uri)


        logging.debug("looking up webbox URI of person: "+person_uri)
        response = self._get_webbox(person_uri)

        if response is not None:
            return response


        logging.debug("did not find webbox uri.")
        return None


    def uri2path(self, uri):
        """ Convert a URI to a path, so that we can store a URI in a file without a path etc. """

        # first do something special - if this URL is in our webbox, then store it natively so we can GET it later
        if uri.startswith(self.webbox_url):
            parsed = urlparse(uri)
            uri_path = parsed.path
            logging.debug("Uri2path of webbox uri: " + uri_path)
            # already includes the /webbox/ path
            return uri_path

        # add the /webbox/ path
        return self.path + os.sep + re.sub(r'[^A-Za-z0-9_-]','.',uri)

    def send_message(self, recipient_uri, message_resource_uri):
        """ Send an external message to a recipient. """

        # URI to HTTP PUT to
        webbox_uri = self.get_webbox(recipient_uri)
        if webbox_uri is None:
            logging.debug("Could not get webbox of " + recipient_uri)
            return "Couldn't get webbox of: " + recipient_uri

        # generate our RDF message to "PUT"
        graph = Graph()
        graph.add(
            (rdflib.URIRef(message_resource_uri),
             rdflib.URIRef(WebBox.to_predicate),
             rdflib.URIRef(recipient_uri)))
        
        rdf = graph.serialize(format="xml") # rdf/xml

        # generate our filename as a GUID
        filename = uuid.uuid1().hex

        logging.debug("type of webbox_uri %s, os.sep %s, filename %s" % (str(type(webbox_uri)), str(type(os.sep)), str(type(filename))))
        logging.debug("webbox_uri %s, os.sep %s, filename %s" % (str(webbox_uri), str(os.sep), str(filename)))
        req_uri = webbox_uri + os.sep + filename
        try:
            # HTTP PUT to their webbox
            opener = urllib2.build_opener(urllib2.HTTPHandler)
            request = urllib2.Request(req_uri, data=rdf)
            request.add_header('Content-Type', 'application/rdf+xml') # because format="xml" above
            request.get_method = lambda: 'PUT'
            url = opener.open(request)
            return True
        except Exception as e:
            """ Couldn't send a message fast-fail. """
            logging.debug("Couldn't send a message to: " + req_uri)
            return "Couldn't connect to %s" % req_uri


    def _handle_webbox_rdf(self, graph):
        """ Check if this RDF graph contains any webbox trigger RDF, i.e. sioc:to_address, webbox:subscribe, etc and deal with it. """

        handler = WebBoxHandler(graph, self)
        return handler.handle_all()


    def do_PUT(self, rfile):
        content_type = "application/rdf+xml"

        put_uri = self.server_url + self.req_path
        logging.debug("PUT of uri: %s" % put_uri)


        size = 0
        if self.environ.has_key("CONTENT_LENGTH"):
            size = int(self.environ['CONTENT_LENGTH'])

        if self.environ.has_key("CONTENT_TYPE"):
            content_type = self.environ['CONTENT_TYPE']

#        for header in self.headers:
#            if header.lower() == 'content-length':
#                size = int(self.headers[header])
#            elif header.lower() == 'content-type':
#                content_type = self.headers[header]
#

        file = ""
        if size > 0:
            # read into file
            file = rfile.read(size)


        if content_type in self.rdf_formats:
            # this is an RDF upload

            rdf_format = self.rdf_formats[content_type]
            
            # deserialise rdf into triples
            graph = Graph()
            graph.parse(StringIO(file), format=rdf_format) # format = xml, n3 etc

            # check for webbox specific messages
            handle_response = self._handle_webbox_rdf(graph) # check if rdf contains webbox-specific rdf, i.e. to_address, subscribe etc
            if handle_response is not None:
                return handle_response # i.e., there is an error, so return it


            # prepare the arguments for local PUTing of this data
            graph_replace = False # default to not replaceing the graph, because we put it in the ReceivedGraph
            graph = self.graph
            if self.req_qs.has_key('graph'):
                graph = self.req_qs['graph'][0]
                path = self.uri2path(graph)
                graph_replace = True # if they have specified the graph, we replace it, since this is a PUT
            else:
                path = self.req_path

            # do SPARQL PUT
            logging.debug("WebBox SPARQL PUT to graph (%s)" % (graph) )

            status = self.proxy.SPARQLPut(graph, path, file, content_type, graph_replace=graph_replace)
            if status > 299:
                return {"data": "Unsuccessful.", "status": status}

            self.add_to_journal(graph)
            return {"data": "Successful.", "status": 200}

        else:
            # this is a FILE upload
            
            # TODO check for hackery properly, i.e. os.chroot
            if ".." in self.req_path:
                return {"data": ".. not allowed in path", "status": 500}

            file_path = self.file_dir + os.sep +self.req_path

            logging.debug("self.file_dir: %s, self.req_path: %s" % (self.file_dir, self.req_path))
            logging.debug("file path is: %s" % file_path)

            exists = os.path.exists(file_path)

            if not exists:
                try:
                    # check if path exists first
                    path = os.path.split(file_path)[0] # folder path without filename
                    if not os.path.exists(path):
                        os.makedirs(path)

                    f = open(file_path, "w")
                    f.write(file)
                    f.close()
                except Exception as e:
                    return {"data": "Error writing to file: %s" % file_path, "status": 500}

                # no adding to journal here, because it's a file
                return {"data": "Created.", "status": 201}
            else:
                return {"data": "Already exists, can't PUT to this resource, use POST to update instead.", "status": 405}
            

        # TODO send something meaningful!
        # NB: we never get here
        #return {"data": "Successful.", "status": 200}



