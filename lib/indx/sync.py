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

    def __init__(self, root_store, database, url):
        """ Initialise with the root box and connection to the INDX db.
        
            root_store -- Connected objectstore to the root box.
            database -- Connection to the database (indx_pg2).
        """
        logging.debug("IndxSync __init__ root_store {0}".format(root_store))

        self.root_store = root_store
        self.database = database
        self.url = url

        # ids of objects we are watching - these are id of objects with types in the TYPES list
        # if their ids appear in the diffs that hit our observer, then we re-run the sync queries against this box
        self.watched_objs = []

        def observer(diff):
            """ Root box callback function returning an update. """
            logging.debug("IndxSync observer, notify: {0}".format(diff))

            def err_cb(failure):
                failure.trap(Exception)
                logging.error("IndxSync observer error from diff: {0}".format(failure))

            logging.debug("IndxSync observer diff: {0}".format(diff))

            try:
                diff = diff['data']
                for obj in self.watched_objs:
                    if obj in diff['added'] or obj in diff['deleted'] or obj in diff['changed']:
                        logging.debug("IndxSync observer, ID '{0}' in watched objs found in the diff".format(obj))
                        raise Exception("break")

                for id, obj in diff['added'].items():
                    if "type" in obj:
                        for val in obj['type']:
                            if val["@value"] in self.TYPES:
                                logging.debug("IndxSync observer, type '{0}' in TYPES found in the diff".format(val["@value"]))
                                raise Exception("break")
                            

                for verb in diff['changed']:
                    for id, obj in diff['changed'][id]:
                        if "type" in obj:
                            for val in obj['type']:
                                if val["@value"] in self.TYPES:
                                    logging.debug("IndxSync observer, type '{0}' in TYPES found in the diff".format(val["@value"]))
                                    raise Exception("break")

            # breaking out of the loops, and then calling the query at the same time
            except Exception as e:
                # id was in watched items, or a diff object was added/changed with a type in the TYPES object
                self.box_query() # TODO use the callbacks here? (doesn't return anything)

        self.observer = observer

        def query_cb(results):
            logging.debug("IndxSync __init__ query_cb, results: {0}".format(results))
            # initial query finished, start listening to changes to the root box
            root_store.listen(observer)

        def err_cb(failure):
            failure.trap()
            e = failure.value
            logging.error("IndxSync __init__ error querying box, raising: {0}".format(e))
            raise e

        self.box_query(initial_query = True).addCallbacks(query_cb, err_cb)


    def destroy(self):
        """ Destroy this sync instance. Stops listening on the database, for example. """
        self.root_store.unlisten(self.observer)


    def box_query(self, initial_query = False):
        """ Query the root box for root box objects. """
        logging.debug("IndxSync box_query on box {0}".format(self.root_store.boxid))
        result_d = Deferred()

        # query for all objects of the types in our list of interesting types
        type_queries = []
        for typ in self.TYPES:
            type_queries.append({"type": typ})

        q_objs = {"$or": type_queries}

        def objs_cb(results):
            logging.debug("IndxSync box_query, objs_cb, results: {0}".format(results))
            
            if initial_query:
                # populate the watched_objs list
                for id, obj in results.items():
                    self.watched_objs.append(id)

#            for server in results:
#                url = server['url'][0]['@value']

            result_d.callback(True) # for the initial call to succeed

        self.root_store.query(q_objs).addCallbacks(objs_cb, result_d.errback)

        return result_d

