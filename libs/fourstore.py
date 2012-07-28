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


import urllib, urllib2, logging

from httputils import http_get, http_put
from sparqlresults import SparqlResults
from sparqlparse import SparqlParse

class FourStore:
    """ Interface to a 4store SPARQL server. """

    def __init__(self, host, port):
        self.host = host + ":" + str(port)
        self.put_path =  "/data/" # same on all 4stores
        self.path = "/sparql/" # 4store query url prefix

    def query(self, sparql_query, headers={}):
        """ Public method to query this store."""
        path = self.path + "?" + urllib.urlencode({"query": sparql_query, "soft-limit": "-1"}) 

        response = http_get(self.host, path, headers)

        logging.debug("query raw results: %s" % str(response))

        sr = SparqlResults()

        s = SparqlParse(sparql_query)
        verb = s.get_verb() # SELECT, CONSTRUCT, DESCRIBE, ASK

        ctype = response['type']
        if verb == "SELECT":
            data = sr.parse_sparql_xml(response['data'])
#            ctype = "application/rdf+xml"
            ctype = "python/data" # FIXME not used anywhere
        elif verb == "CONSTRUCT":
            data = response['data']
            # ctype is as above.

        response = {"status": response['status'], "reason": response['reason'], "data": data, "type": ctype}

        return response

    def put_rdf(self, rdf, content_type, graph):
        """ Public method to PUT RDF into the store - where PUT replaces a graph. """
        path = self.put_path + graph
        return http_put(self.host, path, rdf, content_type)

    def post_rdf(self, rdf, content_type, graph):
        """ Public method to POST RDF into the store - where POST appends to a graph. """
        path = self.put_path
        return self._send_post_4s(self.host, path, {"graph": graph, "mime-type": content_type, "data": rdf})

    def _send_post_4s(self, host, path, args):
        """ Private method to perform a POST to the URL with the data."""

        # TODO put ACL authenication etc here ?
        logging.debug("POST file to: "+host+", at path: "+path)

        opener = urllib2.build_opener(urllib2.HTTPHandler)
        request = urllib2.Request("http://"+host+path, urllib.urlencode(args))
        request.get_method = lambda: "POST"
        url = opener.open(request)

        return {"status": 201, "reason": "Created"} # TODO error handling

