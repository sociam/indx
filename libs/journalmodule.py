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


import logging, os, os.path, json
from journal import Journal

class JournalModule:

    def __init__(self, server_url, path, req_type, req_path, req_qs, environ, proxy, file_dir, config):

        self.server_url = server_url # base url of the server, e.g. http://localhost:8212
        self.path = path # the path this module is associated with, e.g. /webbox
        self.proxy = proxy # a configured SecureStoreProxy instance
        self.file_dir = os.path.realpath(file_dir) # where to store PUT files

        self.webbox_url = self.server_url + self.path # e.g. http://localhost:8212/webbox - used to ref in the RDF

        self.environ = environ # the environment (from WSGI) of the request (i.e., as in apache)
        self.req_path = req_path # the path of the request e.g. /webbox/file.rdf
        self.req_qs = req_qs # the query string of the request as a dict with array elements, e.g. {'q': ['foo']} is ?q=foo
        self.req_type = req_type # the type of query, e.g. the HTTP operation, GET/PUT/POST
        self.config = config # configuration from server

        self.journal = Journal(config.get("securestore", "journalid"))

        logging.debug("new instance of journalmodule with path %s, query string %s and type %s" % (self.req_path, str(self.req_qs), self.req_type))

    def response(self, rfile):
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


