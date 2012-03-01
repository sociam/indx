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


import sys, os

""" Add the SWAP modules to the python path. """
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "cwm", "cwm-1.2.1")) 

from swap import llyn

class CwmStore:
    """ A securestore interface to the W3C's 'cwm' in-memory pure python sparql store. """

    def __init__(self, config):
        self.store = llyn.RDFStore()

    def query(self, sparql_query):
        # TODO implement
        return []

    def put_rdf(self, rdf, content_type, graph):
        # TODO implement
        return None

    def post_rdf(self, rdf, content_type, graph):
        # TODO implement
        return None

