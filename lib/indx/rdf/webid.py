#    Copyright (C) 2014 University of Southampton
#    Copyright (C) 2014 Daniel Alexander Smith
#    Copyright (C) 2014 Max Van Kleek
#    Copyright (C) 2014 Nigel R. Shadbolt
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

import logging
import rdflib

class IndxWebID:

    NS_SPACE = "http://www.w3.org/ns/pim/space#"
    NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    NS_SIOC = "http://rdfs.org/sioc/ns#"
    NS_LDP = "http://www.w3.org/ns/ldp#"

    def __init__(self, webid):
        self.webid = webid
        self.graph = None

    def _parse(self, uri): 
        logging.debug("Parsing graph: {0}".format(uri))
        return self.graph.parse(uri)

    def get_graph(self):
        if self.graph is None:
            self.graph = rdflib.Graph()
            result = self._parse(self.webid) # add to graph
            logging.debug("IndxWebID get_graph result of parsing {0}: {1}".format(self.webid, result))

        return self.graph

    def get_storages(self):
        storages = set()
        
        for s, p, o in self.get_graph().triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_SPACE, "storage")), None) ):
            logging.debug("IndxWebID get_storages s: {0}, p: {1}, o: {2}".format(s, p, o))
            storages.add(o)

        return storages

    def get_spaces(self, storages=None):
        if storages is None:
            storages = self.get_storages()

        spaces = set()
        for storage in storages:
            logging.debug("IndxWebID get_spaces storage: {0}".format(storage))
            result = self._parse("{0}".format(storage))
            logging.debug("IndxWebID get_spaces result of parsing {0}: {1}".format(storage, result))

        for s, p, o in self.get_graph().triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_RDF, "type")), rdflib.URIRef("{0}{1}".format(self.NS_SIOC, "Space")) ) ):
            logging.debug("IndxWebID get_spaces, type sioc:Space s: {0}, p: {1}, o: {2}".format(s, p, o))
            spaces.add(s)

        return spaces

    def get_containers(self, spaces=None):
        if spaces is None:
            spaces = self.get_spaces()

        containers = set()
        for space in spaces:
            logging.debug("IndxWebID get_containers, space: {0}".format(space))
            result = self._parse("{0}".format(space))
            logging.debug("IndxWebID get_containers result of parsing {0}: {1}".format(space, result))

        for s, p, o in self.get_graph().triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_RDF, "type")), rdflib.URIRef("{0}{1}".format(self.NS_LDP, "BasicContainer")) ) ):
            logging.debug("IndxWebID get_containers, type ldp:BasicContainer s: {0}, p: {1}, o: {2}".format(s, p, o))
            containers.add(s)

        return containers

    def get_channels(self, containers=None):
        if containers is None:
            containers = self.get_containers()

        channels = set()
        for container in containers:
            logging.debug("IndxWebID get_channels, container: {0}".format(container))
            result = self._parse("{0}".format(container))
            logging.debug("IndxWebID get_channels result of parsing {0}: {1}".format(container, result))

        candidates = set()
        for s, p, o in self.get_graph().triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_LDP, "contains")), None) ):
            logging.debug("IndxWebID get_channels, ldp:contains: s: {0}, p: {1}, o: {2}".format(s, p, o))
            candidates.add(o)

        for candidate in candidates:
            logging.debug("IndxWebID get_channels candidate: {0}".format(candidate))
            for s, p, o in self.get_graph().triples( (candidate, rdflib.URIRef("{0}{1}".format(self.NS_RDF, "type")), rdflib.URIRef("{0}{1}".format(self.NS_SIOC, "Container"))) ):
                logging.debug("IndxWebID get_channels, (candidate: {3}) type sioc:Container s: {0}, p: {1}, o: {2}".format(s, p, o, candidate))
                channels.add(candidate)

        return channels

    def get_posts(self, channels=None):
        if channels is None:
            channels = self.get_channels()

        posts = set()
        for channel in channels:
            logging.debug("IndxWebID get_posts, channel: {0}".format(channel))
            result = self._parse("{0}".format(channel))
            logging.debug("IndxWebID get_posts result of parsing {0}: {1}".format(channel, result))

        for s, p, o in self.get_graph().triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_RDF, "type")), rdflib.URIRef("{0}{1}".format(self.NS_SIOC, "Post"))) ):
            logging.debug("IndxWebID get_posts, type sioc:Post s: {0}, p: {1}, o: {2}".format(s, p, o))
            posts.add(o)

        posts_full = []
        for post in posts:
            logging.debug("IndxWebID get_posts, post: {0}".format(post))
            post_full = {}
            for s, p, o in self.get_graph().triples( (post, None, None) ):
                logging.debug("IndxWebID get_posts, (post: {3} <p> <o>), s: {0}, p: {1}, o: {2}".format(s, p, o, post))
                if post_full.get(p) is None:
                    post_full[p] = []
                post_full[p].append(o)
            posts_full.append(post_full)

        logging.debug("IndxWebID get_posts, posts_full: {0}".format(posts_full))
        return posts_full


