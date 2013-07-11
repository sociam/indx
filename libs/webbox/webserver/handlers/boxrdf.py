#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
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

import logging, urllib2, uuid, rdflib, os, traceback, mimetypes, shutil, json

from twisted.web.resource import Resource

from rdflib.graph import Graph
from time import strftime
from webboxmessages import WebBoxMessages
from journal import Journal
from mimeparse import best_match
from sparqlresults import SparqlResults
from sparqlparse import SparqlParse
from exception import ResponseOverride
from session import WebBoxSession, ISession

from objectstore import ObjectStore, RDFObjectStore, IncorrectPreviousVersionException

from urlparse import urlparse, parse_qs
from rdflib.serializer import Serializer
from rdflib.plugin import register
import rdfliblocal.jsonld

from webbox.server.handlers.webdav import WebDAVHandler

from webbox.webserver.handlers.base import BaseHandler

class BoxHandler(BaseHandler):
    """ Handles calls to an individual box URI (GET/POST/PUT etc.) """

    base_path = 'webbox' # set by the caller
    subhandlers = [
        {
            "prefix": "update",
            'methods': ['GET'],
            'require_auth': True,
            'require_token': True,
            'handler': BoxHandler.handle_update,
            'accept':'application/json'
        },
        {
            "prefix": "*",            
            'methods': ['GET', 'POST', 'PUT', 'HEAD', 'PROPFIND', 'LOCK', 'UNLOCK', 'DELETE', 'MKCOL', 'MOVE', 'COPY'],
            'require_auth': False,
            'require_token': False,
            'handler': BoxHandler.render,
        },
    ]

    # mime type to rdflib formats (for serializing)
    rdf_formats = {
        "application/rdf+xml": "xml",
        "application/n3": "n3",
        "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
        "text/plain": "nt",
        "application/json": "json-ld",
        "text/json": "json-ld",
    }


    def render(self, request):
        """ Twisted resource handler. """

        logging.debug("Calling BoxHandler render()")
        try:
            session = request.getSession()

            # persists for life of a session (based on the cookie set by the above)
            wbSession = session.getComponent(ISession)
            if not wbSession:
                wbSession = WebBoxSession(session)
                session.setComponent(ISession, wbSession)

            logging.debug("Is user authenticated? {0}".format(wbSession.is_authenticated))

            # handler for requests that require WebDAV
            webdav = WebDAVHandler()

            request.setHeader("DAV", "1, 2")

            # common HTTP methods
            if request.method == "GET":
                response = self.do_GET(request)
            elif request.method == "HEAD":
                response = self.do_GET(request)
            elif request.method == "PUT":
                response = self.do_PUT(request)
            elif request.method == "POST":
                response = self.do_POST(request)
            elif request.method == "OPTIONS":
                response = {"status": 200, "reason": "OK", "data": "", "headers": self.get_supported_method_headers() }

            # WebDAV-only methods
            elif request.method == "PROPFIND":
                response = webdav.do_PROPFIND(request)
            elif request.method == "LOCK":
                response = webdav.do_LOCK(request)
            elif request.method == "UNLOCK":
                response = webdav.do_UNLOCK(request)
            elif request.method == "DELETE":
                response = webdav.do_DELETE(request)
            elif request.method == "MKCOL":
                response = webdav.do_MKCOL(request)
            elif request.method == "MOVE":
                response = webdav.do_MOVE(request)
            elif request.method == "COPY":
                response = webdav.do_COPY(request)

            # Another unsupported method
            else:
                # When you sent 405 Method Not Allowed, you must specify which methods are allowed
                response = {"status": 405, "reason": "Method Not Allowed", "data": "", "headers": self.get_supported_method_headers() }


            # put repository version weak ETag header
            # journal to load the original repository version

            # NOTE have to re-load journal here (instead of using self.journal) because different threads can't share the same sqlite object
            j = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
            
            latest_hash = j.get_version_hashes() # current and previous
            
            if latest_hash['current'] is not None:
                headers.append( ('ETag', "W/\"%s\""%latest_hash['current'] ) ) # 'W/' means a Weak ETag
            if latest_hash['previous'] is not None:
                headers.append( ('X-ETag-Previous', "W/\"%s\""%latest_hash['previous']) ) # 'W/' means a Weak ETag

            if "size" in response:
                data_length = response['size']
            else:
                data_length = len(response['data'])
            
            headers.append( ("Content-length", data_length) )

            # start sending the response
            request.setResponseCode(response['status'], message=response['reason'])
            for header in headers:
                (header_name, header_value) = header
                request.setHeader(header_name, header_value)

            logging.debug("Sending data of size: "+str(data_length))
           
            if request.method == "HEAD": # HEAD was called, so let's not return the body
                return ""
            elif type(response['data']) is unicode:
                logging.debug("Returning unicode")
                return response['data'].encode('utf8')
            elif type(response['data']) is str:
                logging.debug("Returning a string")
                return response['data']
            else:
                logging.debug("Returning an file-like iter (using .read())")
                return response['data'].read()

        except ResponseOverride as e:
            response = e.get_response()
            logging.debug("Response override raised, sending: %s" % str(response))
            request.setResponseCode(response['status'], message=response['reason'])
            request.write(response['data']
            request.finish()

        except Exception as e:
            logging.debug("Error in WebBox.response(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            request.setResponseCode(500, message="Internal Server Error")
            request.finish()


    def get_supported_method_headers(self):
        """ Return an array of "Allow" method tuples. """
        return [  ("Allow", "PUT"),
                  ("Allow", "GET"),
                  ("Allow", "POST"),
                  ("Allow", "HEAD"),
                  ("Allow", "OPTIONS"),

                  # WebDAV methods
                  ("Allow", "PROPFIND"),
                  #not impl#("Allow", "PROPPATCH"),
                  #not impl#("Allow", "TRACE"),
                  #not impl#("Allow", "ORDERPATCH"),
                  ("Allow", "MKCOL"),
                  ("Allow", "DELETE"),
                  ("Allow", "COPY"),
                  ("Allow", "MOVE"),
                  ("Allow", "LOCK"),
                  ("Allow", "UNLOCK"),
                ]
        
        

    def do_POST(self, request):
        """ Handle a POST (update). """
        # POST of RDF is a merge.

        post_uri = self.server_url + request.path
        logging.debug("POST of uri: %s" % post_uri)

        content_type = ""
        if request.getHeader("Content-Type") is not None:
            content_type = request.getHeader("Content-Type")

        # if a .rdf is uploaded, set the content-type manually
        if request.path[-4:] == ".rdf":
            content_type = "application/rdf+xml"
        elif request.path[-3:] == ".n3":
            content_type = "text/turtle"
        elif request.path[-3:] == ".nt":
            content_type = "text/plain"


        size = 0
        if request.getHeader("Content-Length") is not None and request.getHeader("Content-Length") != "":
            size = int(request.getHeader("Content-Length"))


        # determine if this is a hidden file
        path_parts = request.path.split("/")
        hidden_file = False
        if len(path_parts) > 0 and len( path_parts[ len(path_parts) - 1 ]) > 0 and path_parts[ len(path_parts) - 1 ][0] == ".":
            hidden_file = True

        if content_type == "application/x-www-form-urlencoded":
            # SPARQL Query
            if size > 0:
                file = request.content.read(size)
            else:
                raise ResponseOverride(400, "Bad Request")

            req_qs_post = parse_qs(file)
            query = req_qs_post['query'][0]


            # strip off the last slash if it is to /webbox/
            if post_uri == self.box_url + "/":
                post_uri = post_uri[:-1]

            # send to store
            response = self.webbox.query_store.update_query(query)
            if response['status'] > 299:
                # Return the store error if there is one.
                return {"data": "", "status": response['status'], "reason": response['reason']}

            # TODO parse the GRAPH <> out of the query, and on success above, re-create those data files using CONSTRUCT if they are local NS graphs

            return {"data": "", "status": 200, "reason": "OK"}

        elif content_type in self.rdf_formats and not hidden_file:
            logging.debug("content type of PUT is RDF so we also send to store.")

            rdf_format = self.rdf_formats[content_type]

            # read RDF content into file
            file = ""
            if size > 0:
                file = request.content.read(size)
          
            # strip off the last slash if it is to /webbox/
            if post_uri == self.box_url + "/":
                post_uri = post_uri[:-1]

            # set the graph to POST to. the URI itself, or ?graph= if set (compatibility with SPARQL1.1)
            graph = post_uri
            if request.args.has_key('graph'):
                graph = request.args['graph'][0]

            # if they have put to /webbox then we handle it any messages (this is the only URI that we handle messages on)
            if graph == self.box_url:
                graph = self.webbox.received_graph # save (append) into the received graph, not into the server url

                # deserialise rdf into triples so we can use them in python
                rdfgraph = Graph()
                rdfgraph.parse(data=file, format=rdf_format) # format = xml, n3 etc

                # check for webbox specific messages using the handler class
                handle_response = self._handle_webbox_rdf(rdfgraph) # check if rdf contains webbox-specific rdf, i.e. to_address, subscribe etc
                if handle_response is not None:
                    # TODO replace this with raising a ResponseOverride in the handler
                    return handle_response # i.e., there is an error, so return it


            # do SPARQL PUT
            logging.debug("WebBox SPARQL POST to graph (%s)" % (graph) )
            response = self.webbox.SPARQLPost(graph, file, content_type)
            if response['status'] > 299:
                # Return the store error if there is one.
                return {"data": "", "status": response['status'], "reason": response['reason']}


            self.webbox.updated_resource(post_uri, "rdf") # notify subscribers
            self.webbox.add_to_journal(graph) # update journal

            # TODO remake the file on disk (assuming graph is relative to our file) according to the new store status
            if not request.args.has_key('graph'):
                # only make a file if it is a local URI
                file_path = self.webbox.get_file_path(request.path)
                logging.debug("file path is: %s" % file_path)
                exists = os.path.exists(file_path)

                # replace the file with RDF/XML (the default format for resolving URIs), so convert if we have to
                query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % graph
                result = self.webbox.query_store.query(query, {"Accept": "application/rdf+xml"})
                rdf = result['data']

                # write the RDF/XML to the file
                if not os.path.isdir(file_path):
                    f = open(file_path, "w")
                    f.write(rdf)
                    f.close()

                # the [1:] gets rid of the /webbox/ bit of the path, so FIXME be more intelligent?
                self.webbox.add_new_file(os.sep.join(os.path.split(request.path)[1:]), mimetype="application/rdf+xml") # add metadata to store TODO handle error on return false

                if exists:
                    return {"data": "", "status": 204, "reason": "No Content"}
                else:
                    return {"data": "", "status": 201, "reason": "Created"}
                    

            # Return 204
            return {"data": "", "status": 204, "reason": "No Content"}

        else:
            logging.debug("a POST to an existing non-rdf static file (non-sensical): sending a not allowed response")

            # When you send a 405 Method Not Allowed you have to send Allow headers saying which methods ARE allowed.
            return {"data": "", "status": 405, "reason": "Method Not Allowed", "headers": self.get_supported_method_headers() }




    def do_GET(self, request):
        logging.debug("req_path: %s" % (request.path))

        # journal update called
        if request.path == "/update":
            since = None
            if "since" in request.args:
                since = request.args['since'][0]
            return self.handle_update(since)


        if request.getHeader("Accept") is not None:
            accept = request.getHeader("Accept").lower()
        else:
            accept = "*/*" # TODO sensible default?

        # ObjectStore GET
        if "json" in accept: #FIXME do this better
            obj = self.webbox.object_store.get_latest() # FIXME needs callback here
            jsondata = json.dumps(obj, indent=2)        
            return {"data": jsondata, "status": 200, "reason": "OK"}



        if request.args.has_key("query"):
            # SPARQL query because ?query= is present
            query = request.args['query'][0]
            response = self.webbox.query_store.query(query)

            sp = SparqlParse(query)
            verb = sp.get_verb()

            if verb == "SELECT":
                # convert back from a data structure
                sr = SparqlResults()

                xml_type = "application/sparql-results+xml"
                json_type = "application/sparql-results+json"

                if accept == "*/*":
                    # default is XML
                    new_mime = xml_type
                else:
                    # otherwise parse the Accept: header
                    new_mime = best_match([xml_type, json_type], accept)
                
                if new_mime == xml_type:
                    results_xml = sr.sparql_results_to_xml(response['data'])
                    response['data'] = results_xml
                    response['type'] = xml_type
                else:
                    results_json = sr.sparql_results_to_json(response['data'])
                    response['data'] = results_json
                    response['type'] = json_type
                    
            elif verb == "CONSTRUCT":
                # rdf, so allow conversion of type
                # convert based on headers
                response = self._convert_response(response, request)

            return response
        else:
            # is this a plain file that exists?
    
            # if they specify a graph, then that overrides the uri
            graph = None
            if "graph" in request.args:
                graph = request.args['graph'][0]

            if graph is None:
                file_path = self.webbox.get_file_path(request.path)

                logging.debug("file_path {0}".format(file_path))

                if os.path.exists(file_path) and (not os.path.isdir(file_path)):
                    # return the file
                    logging.debug("Opening file: "+file_path)
                    f = open(file_path, "r")
                    size = os.path.getsize(file_path)
                    #filedata = f.read()
                    #f.close()

                    if request.getHeader("Range") is not None:
                        logging.debug("Byte range requested, returning as a string")
                        return {"data": self.get_byte_range(f, request.getHeader("Range")), "status": 200, "reason": "OK"}
                    else:
                        logging.debug("File read into file object started.")
                        mimetype = self.get_file_mime_type(file_path)
                        response = {"data": f, "status": 200, "reason": "OK", "size": size, "type": mimetype}

                        # If the file is RDF/XML that we've written, then we can convert on the fly according to the request's Accept: header
                        if mimetype == "application/rdf+xml":
                            filedata = f.read()
                            f.close()
                            response['data'] = filedata
                            response = self._convert_response(response, request)

                        return response

            try:
                # Look for this URI or any URI that start with this URI+# and return them all as concise bounded graphs S,P,O of all of those uris
                uri = self.server_url + request.path
                if graph is not None:
                    uri = graph

                results = self.webbox.query_store.query("CONSTRUCT{?uri ?p ?o} WHERE {?uri ?p ?o . FILTER(?uri = <%s> || strStarts(str(?uri), \"%s#\") || ?o = <%s> || strStarts(str(?o), \"%s#\"))}" % (uri,uri,uri,uri), {"Accept": "text/plain"})
                rdf = results['data']
                if len(rdf) > 0:
                    response = {"data": rdf, "status": 200, "reason": "OK", "type": "text/plain"}
                    response = self._convert_response(response, request)
                    return response
            except Exception as e:
                logging.debug("Exception finding CBG of uris ({0})".format(str(e)))
                return {"data": "", "status": 500, "reason": "Internal Server Error"}


            # no URIs, no files, return 404 Not Found
            return {"data": "", "status": 404, "reason": "Not Found"}



    def do_PUT(self, request):
        """ Handle a PUT. """
        logging.debug("PUT, headers: " + str(request.requestHeaders))

        # PUT of RDF is to REPLACE the graph
        content_type = "application/rdf+xml"


        put_uri = self.server_url + request.path
        logging.debug("PUT of uri: %s" % put_uri)

        if request.getHeader("Transfer-Encoding") is not None and request.getHeader("Transfer-Encoding").lower() == "chunked":
            # part-file is being uploaded, deal with this slightly differently
            
            size = int(request.getHeader("X-Expected-Entity-Length"))
            content_type = ""
        else:
            size = 0
            if request.getHeader("Content-Length") is not None:
                size = int(request.getHeader("Content-Length"))
            if request.getHeader("Content-Type") is not None:
                content_type = request.getHeader("Content-Type")

        # check for a hidden file
        path_parts = request.path.split("/")
        hidden_file = False
        if len(path_parts) > 0 and len( path_parts[ len(path_parts) - 1 ]) > 0 and path_parts[ len(path_parts) - 1 ][0] == ".":
            hidden_file = True

        # if a .rdf is uploaded, set the content-type manually
        if request.path[-4:] == ".rdf":
            content_type = "application/rdf+xml"
        elif request.path[-3:] == ".n3":
            content_type = "text/turtle"
        elif request.path[-3:] == ".nt":
            content_type = "text/plain"

        file_path = self.webbox.get_file_path(request.path)
        logging.debug("file path is: %s" % file_path)
        exists = os.path.exists(file_path)

        file = ""
        # parse RDF, but not if it's hidden (hidden is usually a small file from Finder's WebDAV)

        json_content_types = [
            "application/json",
            "text/json",
        ]

        is_objectstore = content_type and content_type in json_content_types


        if (not is_objectstore) and (request.path == "" or request.path == "/"):
            # PUT to / isn't valid (unless objectstore), they can only POST to these (it's the spool incoming)

            # When you send a 405 Method Not Allowed you have to send Allow headers saying which methods ARE allowed.
            headers = [ 
              #invalid for here#("Allow", "PUT"),
              ("Allow", "GET"),
              ("Allow", "POST"),
              ("Allow", "HEAD"),
              ("Allow", "OPTIONS"),

              # WebDAV methods
              ("Allow", "PROPFIND"),
              #not impl#("Allow", "PROPPATCH"),
              #not impl#("Allow", "TRACE"),
              #not impl#("Allow", "ORDERPATCH"),
              #invalid for here#("Allow", "MKCOL"),
              #invalid for here#("Allow", "DELETE"),
              #invalid for here#("Allow", "COPY"),
              #invalid for here#("Allow", "MOVE"),
              #invalid for here#("Allow", "LOCK"),
              #invalid for here#("Allow", "UNLOCK"),
            ]
            return {"data": "", "status": 405, "reason": "Method Not Allowed", "headers": headers}


        if is_objectstore:
            # objectstore PUT

            jsondata = request.content.read()
            objs = json.loads(jsondata)

            if type(objs) == type([]):
                # multi object put
            
                if "graph" not in request.args:
                    return {"data": "Specify a graph URI with &graph=", "status": 404, "reason": "Not Found"}
                graph_uri = request.args['graph'][0]

                if "version" not in request.args:
                    return {"data": "Specify a previous version with &version=", "status": 404, "reason": "Not Found"}
                prev_version = int(request.args['version'][0])

                try:
                    new_version_info = self.webbox.object_store.replace(graph_uri, objs, prev_version)
                except IncorrectPreviousVersionException as ipve:
                    logging.debug("Incorrect previous version")
                    actual_version = ipve.version
                    return {"data": "{\"error\": \"Document obsolete. Please update before putting\", \"@version\": %s}\n" % actual_version, "status": 409, "reason": "Obsolete"}

                return {"data": json.dumps(new_version_info), "status": 201, "reason": "Created", "type": "application/json"}
            else:
                # single object put
                return {"data": "Single object PUT not supported, PUT an array to create/replace a named graph instead.", "status": 404, "reason": "Not Found"}



        elif content_type in self.rdf_formats and not hidden_file:
            # this is an RDF upload

            if size > 0:
                # read into file
                file = request.content.read(size)
                
                # prepare the arguments for local PUTing of this data
                graph = put_uri
                if request.args.has_key('graph'):
                    graph = request.args['graph'][0]

                # do SPARQL PUT
                logging.debug("WebBox SPARQL PUT to graph (%s)" % (graph) )

                response = self.webbox.SPARQLPut(graph, file, content_type)
                if response['status'] > 299:
                    return {"data": "", "status": response['status'], "reason": response['reason']}

                self.webbox.add_to_journal(graph)

                # replace the file with RDF/XML (the default format for resolving URIs), so convert if we have to
                query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % graph
                result = self.webbox.query_store.query(query, {"Accept": "application/rdf+xml"})
                rdf = result['data']
            else:
                rdf = ""

            
            if not os.path.isdir(file_path):
                # write the RDF/XML to the file
                f = open(file_path, "w")
                f.write(rdf)
                f.close()

            # the [1:] gets rid of the /webbox/ bit of the path, so FIXME be more intelligent?
            self.webbox.add_new_file(os.sep.join(os.path.split(request.path)[1:]), mimetype="application/rdf+xml") # add metadata to store TODO handle error on return false
        else:
            # Handle a static file PUT
            try:
                # check if path exists first
                path = os.path.split(file_path)[0] # folder path without filename
                if not os.path.exists(path):
                    os.makedirs(path)

                f = open(file_path, "w")
                if size > 0:
                    if file == "":
                        # copy straight from rfile
                        shutil.copyfileobj(request.content, f, size)
                    else:
                        # already loaded (by RDF handler, above), write directly
                        f.write(file)
                f.close()

                # the [1:] gets rid of the /webbox/ bit of the path, so FIXME be more intelligent?
                self.webbox.add_new_file(os.sep.join(os.path.split(request.path)[1:])) # add metadata to store TODO handle error on return false
            except Exception as e:
                logging.debug(str( "Error writing to file: %s, exception is: %s" % (file_path, str(e)) ) + traceback.format_exc())
                return {"data": "", "status": 500, "reason": "Internal Server Error"}

        # no adding to journal here, because it's a file
        if exists:
            return {"data": "", "status": 204, "reason": "No Content"}
        else:
            return {"data": "", "status": 201, "reason": "Created"}
            
            

    def _handle_webbox_rdf(self, graph):
        """ Check if this RDF graph contains any webbox trigger RDF, i.e. sioc:to_address, webbox:subscribe, etc and deal with it. """

        msgs = WebBoxMessages(graph, self.webbox)
        return msgs.handle_all()

                    
    def get_byte_range(self, file, byterange):
        """ Return a range of bytes as specified by the HTTP_RANGE header. """

        # byterange is like: bytes=1380533830-1380533837
        (offset, end) = byterange.split("bytes=")[1].split("-")
        length = int(end) - int(offset)

        file.seek(int(offset))
        data = file.read(length)
        file.close()
        return data

    def get_file_mime_type(self, file_path):
        """ Get the mimetype of a file on disk. """
        return mimetypes.guess_type(file_path)[0] 


    def _convert_response(self, response, request):
        logging.debug("convert_response, response: "+str(response))

        if not (response['status'] == 200 or response['status'] == "200 OK"):
            logging.debug("Not converting data, status is not 200.")
            return response # only convert 200 OK responses

        status = response['status']
        reason = response['reason']
        type = None
        if "type" in response:
            type = response['type'].lower()
        data = response['data']

        if request.getHeader("Accept") is not None:
            accept = request.getHeader("Accept").lower()
        else:
            accept = "*/*" # TODO sensible default?

        if accept == "*/*":
            logging.debug("Not converting, client accepts anything.") # for performance and compatiblity
            return response

        if type is not None and accept == type:
            logging.debug("Not converting data, type is identical to that requested.")
            return response

        # data
        new_mime = best_match(self.rdf_formats.keys(), accept)
        if new_mime in self.rdf_formats and type is not None:
            new_data = self._convert(data, type, new_mime)
            new_response = {"status": status,
                            "reason": reason,
                            "type": new_mime,
                            "data": new_data}

            logging.debug("Returning converted response from "+type+" to "+accept+".")
            return new_response

        else:
            logging.debug("Can't understand Accept header of "+accept+", or content type is None, so returning data as-is.")
            return response

    def handle_update(self,request):
        """ Handle calls to the Journal update URL. """
        since_repository_hash = None
        if "since" in request.args:
           since_repository_hash = request.args['since'][0]                        
        journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
        uris_changed = journal.since(since_repository_hash)
        logging.debug("URIs changed: %s" % str(uris_changed))

        if len(uris_changed) > 0:

            ntrips = ""
            for uri in uris_changed:
                query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
                logging.debug("Sending query for triples as: %s " % query)

                result = self.webbox.query_store.query(query, {"Accept": "text/plain"})
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


    def _strip_charset(self, mime):
        """ Strip the charset from a mime-type. """

        if ";" in mime:
            return mime[:mime.index(";")]

        return mime


