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


import logging, re, urllib2, uuid, rdflib, os, os.path, traceback, mimetypes

from rdflib.graph import Graph
from time import strftime
from urlparse import urlparse
from webboxhandler import WebBoxHandler
from subscriptions import Subscriptions
from journal import Journal
from websocketclient import WebSocketClient
from mimeparse import best_match
from httputils import resolve_uri, http_get, http_put, http_post
from sparqlresults import SparqlResults
from sparqlparse import SparqlParse
from fourstoremgmt import FourStoreMgmt
from fourstore import FourStore

from urlparse import urlparse, parse_qs
from rdflib.serializer import Serializer
from rdflib.plugin import register
import rdfliblocal.jsonld

class WebBox:
    # to use like WebBox.to_predicate
    webbox_ns = "http://webbox.ecs.soton.ac.uk/ns#"

    to_predicate = "http://rdfs.org/sioc/ns#addressed_to"
    address_predicate = webbox_ns + "address"
    files_graph = webbox_ns + "UploadedFiles" # the graph with metadata about files (non-RDF)
    subscribe_predicate = webbox_ns + "subscribe_to" # uri for subscribing to a resource
    unsubscribe_predicate = webbox_ns + "unsubscribe_from" # uri for unsubscribing from a resource
    graph = webbox_ns + "ReceivedGraph" # default URI for 4store inbox

    def __init__(self, path, config):

        self.path = path # path of this webbox e.g. /webbox
        # use 4store query_store
        self.query_store = FourStore(config['4store']['host'], config['4store']['port'])

        self.config = config # configuration from server

        self.server_url = config["url"] # base url of the server, e.g. http://localhost:8212
        self.webbox_url = self.server_url + self.path # e.g. http://localhost:8212/webbox - used to ref in the RDF
        self.file_dir = os.path.join(config['webbox_dir'],config['file_dir'])
        self.file_dir = os.path.realpath(self.file_dir) # where to store PUT files

        logging.debug("Started new WebBox at URL: " + self.webbox_url)


        # config rdflib first
        register("json-ld", Serializer, "rdfliblocal.jsonld", "JsonLDSerializer")

        # mime type to rdflib formats (for serializing)
        self.rdf_formats = {
            "application/rdf+xml": "xml",
            "application/n3": "n3",
            "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
            "text/plain": "nt",
            "application/json": "json-ld",
            "text/json": "json-ld",
        }

        self.websocket = WebSocketClient(host=config['ws_hostname'],port=['ws_port']) #TODO from config file

        # run 4store 
        self.fourstore = FourStoreMgmt(config['4store']['kbname'], http_port=config['4store']['port']) 
        self.fourstore.start()


    def stop(self):
        """ Shut down the web box. """
        self.fourstore.stop()


    def response(self, environ, start_response):
        """ WSGI response handler."""

        logging.debug("Calling WebBox response().")
        try:
            req_type = environ['REQUEST_METHOD']
            rfile = environ['wsgi.input']

            if "REQUEST_URI" in environ:
                url = urlparse(environ['REQUEST_URI'])
                req_path = url.path
                req_qs = parse_qs(url.query)
            else:
                req_path = environ['PATH_INFO']
                req_qs = parse_qs(environ['QUERY_STRING'])

            # add the module path onto the req_path
            req_path = self.path + req_path

            if req_type == "POST":
                response = self.do_POST(rfile, environ, req_path, req_qs)
            elif req_type == "PUT":
                response = self.do_PUT(rfile, environ, req_path, req_qs)
            elif req_type == "OPTIONS":
                reponse = self.do_OPTIONS()
            else:
                response = self.do_GET(environ, req_path, req_qs)

            # get headers from response if they exist
            headers = []
            if "headers" in response:
                headers = response['headers']

            # set a content-type
            if "type" in response:
                headers.append( ("Content-type", response['type']) )
            else:
                headers.append( ("Content-type", "text/plain") )

            # add CORS headers (blanket allow, for now)
            headers.append( ("Access-Control-Allow-Origin", "*") )
            headers.append( ("Access-Control-Allow-Methods", "POST, GET, PUT, OPTIONS") )

            # put repository version weak ETag header
            # journal to load the original repository version

            # NOTE have to re-load journal here (instead of using self.journal) because different threads can't share the same sqlite object
            j = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
            
            latest_hash = j.get_version_hashes() # current and previous
            
            if latest_hash['current'] is not None:
                headers.append( ('ETag', "W/\"%s\""%latest_hash['current'] ) ) # 'W/' means a Weak ETag
            if latest_hash['previous'] is not None:
                headers.append( ('X-ETag-Previous', "W/\"%s\""%latest_hash['previous']) ) # 'W/' means a Weak ETag

            data_length = len(response['data'])
            headers.append( ("Content-length", data_length) )

            start_response(str(response['status']) + " " + response['reason'], headers)
            logging.debug("Sending data of size: "+str(data_length))
            return [response['data']]

        except Exception as e:
            logging.debug("Error in WebBox.response(), returning 500: "+str(e))
            start_response("500 Internal Server Error", ())
            return [""]


    def do_OPTIONS(self):
        logging.debug("Sending 200 response to OPTIONS")
        return {"status": 200, "reason": "OK", "data": "", "headers":
            [ ("Allow", "PUT"),
              ("Allow", "GET"),
              ("Allow", "POST"),
              ("Allow", "OPTIONS"),
            ]
        } 

    def add_to_journal(self, graphuri):
        """ This Graph URI was added or changed, add to the journal. """

        logging.debug("Journal updating on graph: "+graphuri)

        repository_hash = uuid.uuid1().hex # TODO in future, make this a hash instead of a uuid

        journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
        journal.add(repository_hash, [graphuri])

        self.update_websocket_clients()

    def update_websocket_clients(self):
        """ There has been an update to the webbox store, so send the changes to the clients connected via websocket. """
        logging.debug("Updating websocket clients...")

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


    def get_subscriptions(self):
        """ Get a new subscriptions object, used by this class and also the webbox handler. """
        filename = os.path.join(self.config['webbox_dir'],self.config['subscriptions'])
        return Subscriptions(filename)

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
                logging.debug("error notifying subscriber: %s, moving on." % subscriber)

        return None # success

    def do_POST(self, rfile, environ, req_path, req_qs):
        """ Handle a POST (update). """

        post_uri = self.server_url + req_path
        logging.debug("POST of uri: %s" % post_uri)


        # TODO check for hackery properly, i.e. os.chroot
        if ".." in req_path:
            return {"data": ".. not allowed in path", "status": 500, "reason": "Internal Server Error"}

        file_path = self.file_dir + os.sep + req_path

        logging.debug("self.file_dir: %s, req_path: %s" % (self.file_dir, req_path))
        logging.debug("file path is: %s" % file_path)

        if environ.has_key("CONTENT_TYPE"):
            content_type = environ['CONTENT_TYPE']


        # if a .rdf is uploaded, set the content-type manually
        if req_path[-4:] == ".rdf":
            content_type = "application/rdf+xml"
        elif req_path[-3:] == ".n3":
            content_type = "text/turtle"
        elif req_path[-3:] == ".nt":
            content_type = "text/plain"



        if content_type in self.rdf_formats:
            logging.debug("content type of PUT is RDF so we also send to 4store.")

            rdf_format = self.rdf_formats[content_type]

            size = 0
            if environ.has_key("CONTENT_LENGTH"):
                size = int(environ['CONTENT_LENGTH'])

            file = ""
            if size > 0:
                # read into file
                file = rfile.read(size)
            
            # deserialise rdf into triples
            graph = Graph()
            graph.parse(data=file, format=rdf_format) # format = xml, n3 etc

            # check for webbox specific messages
            handle_response = self._handle_webbox_rdf(graph) # check if rdf contains webbox-specific rdf, i.e. to_address, subscribe etc
            if handle_response is not None:
                return handle_response # i.e., there is an error, so return it


            # prepare the arguments for local PUTing of this data
            graph = self.graph
            if req_qs.has_key('graph'):
                graph = req_qs['graph'][0]
                path = self.uri2path(graph)
            else:
                path = req_path

            # do SPARQL PUT
            logging.debug("WebBox SPARQL POST to graph (%s)" % (graph) )

            response1 = self.SPARQLPost(graph, path, file, content_type)
            if response1['status'] > 299:
                return {"data": "Unsuccessful.", "status": response1['status'], "reason": response1['reason']}


            self.updated_resource(post_uri, "rdf") # notify subscribers
            self.add_to_journal(graph)
            return {"data": "Successful.", "status": 200, "reason": "OK"}

        else:
            logging.debug("a POST of a file")
            # Not RDF content type, so lets treat as a file upload
            exists = os.path.exists(file_path)

            if exists:
                logging.debug("file existed, so we're removing it, and then calling a PUT internally")
                os.remove(file_path)

            put_response = self.do_PUT(rfile, environ, req_path, req_qs)
            if put_response['status'] == 201:
                self.updated_resource(post_uri, "file") # notify subscribers
                return {"data": "Updated", "status": 200, "reason": "OK"}
            else:
                return put_response
        # never reach here

    def handle_update(self, since_repository_hash):
        """ Handle calls to the Journal update URL. """

        journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
        uris_changed = journal.since(since_repository_hash)
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

            # TODO conneg
            rdf_type = "text/plain" # text/plain is n-triples (really)

            return {"data": ntrips, "status": 200, "reason": "OK", "type": rdf_type}

        else:
            # no update
            logging.debug("Client is up to date")
            return {"data": "", "status": 204, "reason": "No Content"}



    def do_GET(self, environ, req_path, req_qs):
        logging.debug("path: %s req_path: %s" % (self.path, req_path))

        # journal update called
        if req_path == self.path + "/update":
            since = None
            if "since" in req_qs:
                since = req_qs['since'][0]
            return self.handle_update(since)

        if req_qs.has_key("query"):
            # SPARQL query because ?query= is present
            query = req_qs['query'][0]
            response = self.query_store.query(query)

            sp = SparqlParse(query)
            verb = sp.get_verb()

            if verb == "SELECT":
                # convert back from a data structure
                sr = SparqlResults()
                results_xml = sr.sparql_results_to_xml(response['data'])
                response['data'] = results_xml
                response['type'] = "application/sparql-results+xml"
            elif verb == "CONSTRUCT":
                # rdf, so allow conversion of type
                # convert based on headers
                response = self._convert_response(response, environ)

            return response
        else:
            # is this a plain file that exists?
            # TODO check for hackery properly, i.e. os.chroot
            if ".." in req_path:
                return {"data": ".. not allowed in path", "status": 403, "reason": "Forbidden"}

            file_path = self.file_dir + os.sep + req_path
            if os.path.exists(file_path):
                # return the file
                logging.debug("Opening file: "+file_path)
                f = open(file_path, "r")
                filedata = f.read()
                f.close()
                logging.debug("File read complete.")
                return {"data": filedata, "status": 200, "reason": "OK"}
            else:
                return {"data": "", "status": 404, "reason": "Not Found"}

    def _strip_charset(self, mime):
        """ Strip the charset from a mime-type. """

        if ";" in mime:
            return mime[:mime.index(";")]

        return mime

    def _convert(self, data, from_type, to_type):
        """ Convert rdf from one mime-type to another. """
        from_type = self._strip_charset(from_type)
        to_type = self._strip_charset(to_type)

        old_format = self.rdf_formats[from_type]
        new_format = self.rdf_formats[to_type]

        graph = Graph()
        graph.parse(data=data, format=old_format) # format = xml, n3 etc

        # reserialise into new format
        new_data = graph.serialize(format=new_format) # format = xml, n3, nt, turtle etc
        return new_data

    def _convert_response(self, response, environ):
        logging.debug("convert_response, response: "+str(response))

        if not (response['status'] == 200 or response['status'] == "200 OK"):
            logging.debug("Not converting data, status is not 200.")
            return response # only convert 200 OK responses

        status = response['status']
        reason = response['reason']
        type = response['type'].lower()
        data = response['data']

        accept = environ['HTTP_ACCEPT'].lower()

        if accept == "*/*":
            logging.debug("Not converting, client accepts anything.") # for performance and compatiblity
            return response

        if accept == type:
            logging.debug("Not converting data, type is identical to that requested.")
            return response

        # data
        new_mime = best_match(self.rdf_formats.keys(), accept)
        if new_mime in self.rdf_formats:
            new_data = self._convert(data, type, new_mime)
            new_response = {"status": status,
                            "reason": reason,
                            "type": new_mime,
                            "data": new_data}

            logging.debug("Returning converted response from "+type+" to "+accept+".")
            return new_response

        else:
            logging.debug("Can't understand Accept header of "+accept+", so returning data as-is.")
            return response
        

    def _get_webbox(self, person_uri):

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

    def get_webbox(self, person_uri):
        """ Get the webbox URL of a person's URI. """

        logging.debug("looking up webbox URI of person: "+person_uri)
        response = self._get_webbox(person_uri)

        if response is not None:
            return response
        
        # did not have it in the local store, resolve it instead:
        try:
            rdf = resolve_uri(person_uri)
        except Exception as e:
            logging.debug("Did not resolve webbox from the person's (FOAF) URI: "+person_uri)
            return None

        logging.debug("resolved it.")

        # put into 4store 
        # put resolved URI into the store
        # put into its own graph URI in 4store
        # TODO is uri2path the best thing here? or GUID it maybe?
        response1 = self.SPARQLPut(person_uri, self.uri2path(person_uri), rdf, "application/rdf+xml")
        logging.debug("Put it in the store: "+str(status))

        if response1['status'] > 299:
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

    def add_new_file(self, filename):
        """ Add a new file to the files graph (it was just updated/uploaded). """
        logging.debug("Adding a new file metadata to the store for file: "+filename)

        uri = self.webbox_url + os.sep + filename

        # create the RDF
        graph = Graph()
        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
             rdflib.URIRef(self.webbox_ns + "File")))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef(self.webbox_ns+"filename"),
             rdflib.Literal(filename)))

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

        status = self.SPARQLPost(self.files_graph, uri, rdf, "application/rdf+xml")

        logging.debug("Put a webbox:File in the store: "+str(status))

        if status['status'] > 299:
            logging.debug("Put failed: "+str(status))
            return False

        self.add_to_journal(self.files_graph)

        return True


    def _handle_webbox_rdf(self, graph):
        """ Check if this RDF graph contains any webbox trigger RDF, i.e. sioc:to_address, webbox:subscribe, etc and deal with it. """

        handler = WebBoxHandler(graph, self)
        return handler.handle_all()


    def do_PUT(self, rfile, environ, req_path, req_qs):
        content_type = "application/rdf+xml"

        put_uri = self.server_url + req_path
        logging.debug("PUT of uri: %s" % put_uri)


        size = 0
        if environ.has_key("CONTENT_LENGTH"):
            size = int(environ['CONTENT_LENGTH'])

        if environ.has_key("CONTENT_TYPE"):
            content_type = environ['CONTENT_TYPE']


        # if a .rdf is uploaded, set the content-type manually
        if req_path[-4:] == ".rdf":
            content_type = "application/rdf+xml"
        elif req_path[-3:] == ".n3":
            content_type = "text/turtle"
        elif req_path[-3:] == ".nt":
            content_type = "text/plain"


        if content_type in self.rdf_formats:
            # this is an RDF upload
            file = ""
            if size > 0:
                # read into file
                file = rfile.read(size)



            rdf_format = self.rdf_formats[content_type]
            
            # deserialise rdf into triples
            graph = Graph()
            graph.parse(data=file, format=rdf_format) # format = xml, n3 etc

            # check for webbox specific messages
            handle_response = self._handle_webbox_rdf(graph) # check if rdf contains webbox-specific rdf, i.e. to_address, subscribe etc
            if handle_response is not None:
                return handle_response # i.e., there is an error, so return it


            # prepare the arguments for local PUTing of this data
            graph_replace = False # default to not replaceing the graph, because we put it in the ReceivedGraph
            graph = self.graph
            if req_qs.has_key('graph'):
                graph = req_qs['graph'][0]
                path = self.uri2path(graph)
                graph_replace = True # if they have specified the graph, we replace it, since this is a PUT

            else:
                path = req_path

            # do SPARQL PUT
            logging.debug("WebBox SPARQL PUT to graph (%s)" % (graph) )

            response1 = self.SPARQLPut(graph, path, file, content_type, graph_replace=graph_replace)
            if response1['status'] > 299:
                return {"data": "Unsuccessful.", "status": response1['status'], "reason": response1['reason']}

            # TODO save to a file also?

            self.add_to_journal(graph)
            return {"data": "Successful.", "status": 200, "reason": "OK"}

        else:
            # this is a FILE upload
            
            # TODO check for hackery properly, i.e. os.chroot
            if ".." in req_path:
                return {"data": ".. not allowed in path", "status": 500, "reason": "Internal Server Error"}

            file_path = self.file_dir + os.sep + req_path

            logging.debug("self.file_dir: %s, req_path: %s" % (self.file_dir, req_path))
            logging.debug("file path is: %s" % file_path)

            exists = os.path.exists(file_path)

            try:
                # check if path exists first
                path = os.path.split(file_path)[0] # folder path without filename
                if not os.path.exists(path):
                    os.makedirs(path)

                f = open(file_path, "w")
                if size > 0:
                    f.write(rfile.read(size)) # TODO can this be more efficient?
                f.close()
    
                # the [1:] gets rid of the /webbox/ bit of the path, so FIXME be more intelligent?
                self.add_new_file(os.sep.join(os.path.split(req_path)[1:])) # add metadata to store TODO handle error on return false
            except Exception as e:
                logging.debug(str( "Error writing to file: %s, exception is: %s" % (file_path, str(e)) )) 
                return {"data": "", "status": 500, "reason": "Internal Server Error"}

            # no adding to journal here, because it's a file
            return {"data": "Created.", "status": 201, "reason": "Created"}
            

        # TODO send something meaningful!
        # NB: we never get here
        #return {"data": "Successful.", "status": 200}

    def SPARQLPut(self, graph, filename, file, content_type, graph_replace=True):
        """ Handle a SPARQL PUT request. 'graph' is for 4store, 'filename' is for RWW. """

        # send file to query store
        if graph_replace: # force a replace? usually yes, e.g. where graph is a file, otherwise dont, e.g. ReceivedGraph
            logging.debug("replacing graph %s with rdf" % graph)
            response1 = self.query_store.put_rdf(file, content_type, graph)
        else:
            logging.debug("appending to graph %s with rdf" % graph)
            response1 = self.query_store.post_rdf(file, content_type, graph)

        return response1


    def SPARQLPost(self, graph, filename, file, content_type):
        """ Handle a SPARQL POST (append) request. 'graph' is for 4store, 'filename' is for RWW. """

        # send file to query store (4store)
        logging.debug("POST to query store.")
        response1 = self.query_store.post_rdf(file, content_type, graph)

        return response1

