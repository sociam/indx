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

import logging

from py4s import FourStore

from sparqlresults import SparqlResults
from sparqlparse import SparqlParse

import rdflib
try:
    from rdflib.term import URIRef, Literal, BNode
    from rdflib.namespace import RDF, RDFS
    from rdflib.graph import Graph, ConjunctiveGraph
except ImportError:
    from rdflib import URIRef, RDF, RDFS, Literal, BNode
    from rdflib.Graph import Graph, ConjunctiveGraph


class Py4SStore:
    """ Interface to a 4store SPARQL server via py4s. """

    def __init__(self, kb):
        self.kb = kb
        self.store = FourStore(self.kb)
        self.graph = ConjuctiveGraph(self.store)

    def query(self, sparql_query, headers={}):
        """ Public method to query this store."""
        results = self.graph.query(sparql_query)
        # TODO handle errors, return different status
        response = {"status": 200, "reason": "OK", "data": results, "type": "application/sparql-results+xml"}

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


