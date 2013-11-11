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
import logging
import json
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure

NS_ROOT_BOX = u"http://indx.ecs.soton.ac.uk/ontology/root-box/#"

class IndxSync:
    """ Handle Indx Synchronisation of data across multiple boxes/servers. """

    # list of object "types" we are interested in
    # if any object of these types are added/changed/deleted in a diff, then we re-run the sync queries against the box
    # (i.e. where the following are the in the list of values of the property "type")
    TYPES = [
        NS_ROOT_BOX + u"box",
        NS_ROOT_BOX + u"server",
        NS_ROOT_BOX + u"user",
        NS_ROOT_BOX + u"payload",
        NS_ROOT_BOX + u"message",
    ]

    def __init__(self, root_store, indx_db, url):
        """ Initialise with the root box and connection to the INDX db.
        
            root_store -- Connected objectstore to the root box.
            indx_db -- Connection to the INDX database.
        """
        logging.debug("IndxSync __init__ root_store {0}".format(root_store))

        self.root_store = root_store
        self.indx_db = indx_db
        self.url = url

        # ids of objects we are watching - these are id of objects with types in the TYPES list
        # if their ids appear in the diffs that hit our observer, then we re-run the sync queries against this box
        self.watched_objs = []

        root_store.listen(lambda *x: self.observer(*x))


    def box_query(self):
        """ Query the root box for root box objects. """
        logging.debug("IndxSync box_query")
        result_d = Deferred()

        # query for all objects of the types in our list of interesting types
        type_queries = []
        for typ in self.TYPES:
            type_queries.append({"type": typ})

        q_objs = {"$or": type_queries}

        def objs_cb(results):
            logging.debug("IndxSync box_query, objs_cb, results: {0}".format(results))

#            for server in results:
#                url = server['url'][0]['@value']

        self.root_store.query(q_objs).addCallbacks(objs_cb, result_d.errback)

        return result_d


    def observer(self, diff):
        """ Root box callback function returning an update. """
        logging.debug("IndxSync observer, notify: {0}".format(diff))

        def err_cb(failure):
            failure.trap(Exception)
            logging.error("IndxSync observer error from diff: {0}".format(failure))

        logging.debug("IndxSync observer diff: {0}".format(diff))
        # FIXME do something


