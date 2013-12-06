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
import uuid
from indx.crypto import generate_rsa_keypair
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from indx.objectstore_types import Literal
from indxclient import IndxClient, IndxClientAuth

NS_ROOT_BOX = u"http://indx.ecs.soton.ac.uk/ontology/root-box/#"

class IndxSync:
    """ Handle Indx Synchronisation of data across multiple boxes/servers. """

    # list of object "types" we are interested in
    # if any object of these types are added/changed/deleted in a diff, then we re-run the sync queries against the box
    # (i.e. where the following are the in the list of values of the property "type")
    TYPES = [
        NS_ROOT_BOX + u"box",
        NS_ROOT_BOX + u"server",
        NS_ROOT_BOX + u"sync-network",
        NS_ROOT_BOX + u"user",
        NS_ROOT_BOX + u"payload",
        NS_ROOT_BOX + u"message",
        NS_ROOT_BOX + u"key",
    ]

    def __init__(self, root_store, database, url, keystore):
        """ Initialise with the root box and connection to the INDX db.
        
            root_store -- Connected objectstore to the root box.
            database -- Connection to the database (indx_pg2).
            url -- URL of this INDX server
            keystore -- IndxKeystore
        """
        logging.debug("IndxSync __init__ root_store {0}".format(root_store))

        self.root_store = root_store
        self.database = database
        self.url = url
        self.keystore = keystore

        # ids of objects we are watching - these are id of objects with types in the TYPES list
        # if their ids appear in the diffs that hit our observer, then we re-run the sync queries against this box
        self.watched_objs = []

        # internal model of the root store
        self.model = {
        }

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

                def updated_cb(response):
                    # model updated, do a sync now
                    logging.debug("IndxSync observer updated_cb")
                    self.sync_boxes().addCallbacks(lambda foo: logging.debug("IndxSync observer updated_cb (post model-update) sync complete"), err_cb)

                self.update_model_query().addCallbacks(lambda response: updated_cb, err_cb) # TODO use the callbacks here? (doesn't return anything)
            else:
                # only when the box doesn't need to be updated
                # only sync this box, don't update the model first
                self.sync_boxes().addCallbacks(lambda foo: logging.debug("IndxSync observer (no model-update) sync complete"), err_cb)

        self.observer = observer

        def err_cb(failure):
            failure.trap()
            e = failure.value
            logging.error("IndxSync __init__ error querying box, raising: {0}".format(e))
            raise e

        def query_cb(results):
            logging.debug("IndxSync __init__ query_cb, results: {0}".format(results))
            # initial query finished, start listening to changes to the root box
            logging.debug("IndxSync query_cb, model: {0}".format(self.model))

            def sync_cb(empty):
                logging.debug("IndxSync __init__ sync_cb")
                root_store.listen(observer)

            self.sync_boxes().addCallbacks(sync_cb, err_cb)

        self.update_model_query(initial_query = True).addCallbacks(query_cb, err_cb)


    def destroy(self):
        """ Destroy this sync instance. Stops listening on the database, for example. """
        self.root_store.unlisten(self.observer)


    def link_remote_box(self, local_user, remote_address, remote_box, remote_token):
        """ Link a remote box with this local box (either a root box, or just a non-root synced box).

            Requires the credentials of the remote box, and will exchange keys using these credentials, store public keys of each box in the synced boxes, and then not require the credentials again in future to sync.
        """
        logging.debug("IndxSync link_remote_box, local: {0}, to remote: {1} @ {2}".format(self.root_store.boxid, remote_address, remote_box))
        return_d = Deferred()

        local_keys = generate_rsa_keypair(3072)

        def new_remote_key_cb(remote_keys):
            logging.debug("IndxSync link_remote_box, new_remote_key_cb, remote_keys: {0}".format(remote_keys))
            # NB: no "private" in remote_keys, that never leaves the remote box.
            remote_keys = remote_keys['data'] # remove the Indx HTTP response padding

            link_uid = uuid.uuid1()
            local_key_uid = uuid.uuid1()
            remote_key_uid = uuid.uuid1()

            # objects get updated to local box, and then synced across to the other boxes once the syncing starts
            new_objs = [
                {   "@id": "link-{0}".format(link_uid),
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#sync-network"} ],
                    "boxes": [ {"@id": "box-{0}".format(local_key_uid)}, # links to the objs below
                               {"@id": "box-{0}".format(remote_key_uid)}, # links to the objs below
                             ],
                },
                {   "@id": "box-{0}".format(local_key_uid),
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#box"} ],
                    "server-url": [ {"@value": self.url } ],
                    "box": [ {"@value": self.root_store.boxid} ],
                    "key": [ {"@id": local_keys['public-hash']}], # links to the key objs below
                },
                {   "@id": "box-{0}".format(remote_key_uid),
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#box"} ],
                    "server-url": [ {"@value": remote_address } ],
                    "box": [ {"@value": remote_box} ],
                    "key": [ {"@id": remote_keys['public-hash']}], # links to the key objs below
                },
                {   "@id": local_keys['public-hash'],
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#key"} ],
                    "public-key": [ {"@value": local_keys['public']} ], # share the full public keys everywhere (private keys only in respective server's keystores)
                },
                {   "@id": remote_keys['public-hash'],
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#key"} ],
                    "public-key": [ {"@value": remote_keys['public']} ], # share the full public keys everywhere
                },
            ]

            def local_added_cb(empty):
                logging.debug("IndxSync link_remote_box, local_added_cb")

                def ver_cb(ver):
                    logging.debug("IndxSync link_remote_box, ver_cb {0}".format(ver))
                    # add new objects to local store

                    def added_cb(response):
                        # TODO start connecting using the new key
                        pass

                    self.root_store.update(new_objs, ver).addCallbacks(added_cb, return_d.errback)

                self.root_store._get_latest_ver().addCallbacks(ver_cb, return_d.errback)

            # add the local key to the local store
            self.keystore.put(local_keys, local_user).addCallbacks(local_added_cb, return_d.errback) # store in the local keystore

        client = IndxClient(remote_address, remote_box, "INDXSync Server Module", token = remote_token)
        client.generate_new_key().addCallbacks(new_remote_key_cb, return_d.errback)
        return return_d


    def sync_boxes(self):
        """ Synchronise boxes based on the internal model stored in this object. """
        logging.debug("IndxSync sync_boxes")
        return_d = Deferred()

        for user in self.model[NS_ROOT_BOX + u"user"]:
            userid = user.id
            logging.debug("IndxSync sync_boxes user: {0}".format(userid))
            servers = user.get("server")
            for server in servers:
                url = server.get("url")
                if url is None:
                    continue
                url = url[0].value
                logging.debug("IndxSync sync_boxes, server URL for userid {0}: {1}".format(userid, url))
                for box in server.get("box"):
                    name = box.get("name")
                    if name is None:
                        continue
                    name = name[0].value
                    if box.get("root-box") is not None:
                        logging.debug("IndxSync sync_boxes user {0}, server {1}, box {2} is root box".format(userid, url, name))

                        #if box.get("keys") is None:
                        #    # no keys - need to generate


        return_d.callback(True)

        return return_d


    def update_model_query(self, initial_query = False):
        """ Query the root box for root box objects and update the model of the root box here.
        
            This is called at init and also whenever any of the model objects (users/servers/boxes etc.) are in the diff.
        """
        logging.debug("IndxSync update_model_query on box {0}".format(self.root_store.boxid))
        result_d = Deferred()

        # query for all objects of the types in our list of interesting types
        type_queries = []
        for typ in self.TYPES:
            type_queries.append({"type": typ})

        q_objs = {"$or": type_queries}

        def objs_cb(graph):
            logging.debug("IndxSync update_model_query, objs_cb, graph: {0}".format(graph))
            
            if initial_query:
                # populate the watched_objs list
                self.watched_objs = graph.objects().keys()

            # reset model, index by type URI
            self.model = {
            }
            for typ in self.TYPES: self.model[typ] = []

            for id, obj in graph.objects().items():
                vals = obj.get("type")
                if vals:
                    for typ in self.TYPES:
                        for val in vals:
                            if isinstance(val, Literal) and val.value == typ:
                                self.model[typ].append(obj) 

            result_d.callback(True) # for the initial call to succeed

        self.root_store.query(q_objs, render_json = False).addCallbacks(objs_cb, result_d.errback)

        return result_d

