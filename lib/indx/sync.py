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
import copy
from indx.crypto import generate_rsa_keypair
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from indx.objectstore_types import Literal
from indxclient import IndxClient, IndxClientAuth

NS_ROOT_BOX = "http://indx.ecs.soton.ac.uk/ontology/root-box/#"

class IndxSync:
    """ Handle Indx Synchronisation of data across multiple boxes/servers. """

    # list of object "types" we are interested in
    # if any object of these types are added/changed/deleted in a diff, then we re-run the sync queries against the box
    # (i.e. where the following are the in the list of values of the property "type")
    TYPES = [
        NS_ROOT_BOX + "box",
        NS_ROOT_BOX + "link",
        NS_ROOT_BOX + "key",
        NS_ROOT_BOX + "server",
        NS_ROOT_BOX + "user",
        NS_ROOT_BOX + "payload",
        NS_ROOT_BOX + "message",
    ]

    APPID = "INDXSync Client Model"

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
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#link"} ],
                    "boxes": [ {"@id": "box-{0}".format(local_key_uid)}, # links to the objs below
                               {"@id": "box-{0}".format(remote_key_uid)}, # links to the objs below
                             ],
                    "statuses": [
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
                    "public-hash": [ {"@value": local_keys['public-hash']} ], # share the full public keys everywhere (private keys only in respective server's keystores)
                },
                {   "@id": remote_keys['public-hash'],
                    "type": [ {"@value": "http://indx.ecs.soton.ac.uk/ontology/root-box/#key"} ],
                    "public-key": [ {"@value": remote_keys['public']} ], # share the full public keys everywhere
                    "public-hash": [ {"@value": remote_keys['public-hash']} ], # share the full public keys everywhere
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
            self.keystore.put(local_keys, local_user, self.root_store.boxid).addCallbacks(local_added_cb, return_d.errback) # store in the local keystore

        client = IndxClient(remote_address, remote_box, self.APPID, token = remote_token)
        client.generate_new_key().addCallbacks(new_remote_key_cb, return_d.errback)
        return return_d


    def sync_boxes(self):
        """ Synchronise boxes based on the internal model stored in this object. """
        logging.debug("IndxSync sync_boxes")
        return_d = Deferred()

        all_models = copy.copy(self.models)

        def next_model(empty):
            logging.debug("IndxSync sync_boxes next_model")

            if len(all_models) < 1:
                return_d.callback(True)
                return

            model_id = all_models.pop(0)

            def model_cb(model_graph):
                logging.debug("IndxSync sync_boxes model_cb")
                model = model_graph.get(model_id)

                # get up-to-date required information from the synced box
                remote_server_url = None
                remote_box = None
                local_key_hash = None

                # TODO use model_id to get model from root_store

                for box in model.get(NS_ROOT_BOX + "boxes"):
                    boxid = box.get("box")
                    if boxid != self.root_store.boxid:
                        # remote box
                        remote_server_url = box.getOne("server-url")
                        remote_box = box.getOne("box")
                    else:
                        # local box
                        local_key = box.getOne("key")
                        local_key_hash = local_key.getOne("public-hash")

                local_key = self.keystore.get(local_key_hash)
                
                # start sync 
                clientauth = IndxClientAuth(remote_server_url, self.APPID)

                def authed_cb(empty):
                    logging.debug("IndxSync sync_boxes authed_cb")

                    def token_cb(remote_token):
                        logging.debug("IndxSync sync_boxes token_cb")
                        client = IndxClient(remote_server_url, remote_box, self.APPID, client = clientauth.client, token = remote_token)
                        
                        # compare local version to previous, and update one of them, or both
                        self.update_to_latest_version(client, remote_server_url, remote_box).addCallbacks(next_model, return_d.errback)

                    clientauth.get_token(remote_box).addCallbacks(token_cb, return_d.errback)

                clientauth.auth_keys(local_key['private'], local_key_hash).addCallbacks(authed_cb, return_d.errback)

            self.root_store.get_latest_objs([model_id], render_json = False).addCallbacks(model_cb, return_d.errback)

        next_model(None)
        return return_d


    def update_to_latest_version(self, remote_indx_client, remote_server_url, remote_box):
        """ Get the last version seen (consumed) of a remote box. """
        logging.debug("IndxSync update_to_latest_version of server {0} and box {1}".format(self.remote_server_url, self.remote_box))

        # updates the local box to the latest version of the remote box

        result_d = Deferred()

        query = { "type": self.NS_ROOT_BOX + "status",
                  "src-boxid": remote_box,
                  "src-server-url": remote_server_url,
                  "dst-boxid": self.root_store.boxid,
                  "dst-server-url": self.url,
                  # "last-version-seen": 5
                }

        def objs_cb(graph):
            logging.debug("IndxSync update_to_latest_version, objs_cb, graph: {0}".format(graph))
            
            version = 0
            status_id = None
            for id in graph.root_object_ids:
                status = graph.get(id)
                version = int(status.get("last-version-seen"))
                status_id = id
                break

            # TODO lock and perform this in a transaction

            def version_cb(response):
                # query remote store to find actual 'latest 'version
                remote_latest_version = int(response['data'])
                
                if not (remote_latest_version > version):
                    # already up to date
                    result_d.callback(True)
                    return

                def diff_cb(diff_resp):
                    # if actual version is > 'version', then do a diff query with from 'version' to 'latest'
                    diff = diff_resp['data']
                    
                    # request the commits with the diff, and add them to the new version
                    commits = diff['commits']

                    # TODO in future optimise this by only applying the commits we haven't got (needs a database refactor)
                    # TODO change it so that we do:
                    #      1. query for version/commits pairs within a range
                    #      2. check commits against what we know already, and request the diffs of the versions we don't have the commits for
                    #      3. apply only those

                    # check if we have all of these commits already
                    def vers_get_cb(vers_without_commits):
                        if len(vers_without_commits) < 1:
                            # already all applied
                            result_d.callback(True)
                            return

                        # TODO apply diff

                        
                        
                        # TODO update the 'status' object (with @id == 'status_id', above) with the last-version-seen to be 'latest'


                    self.root_store._vers_without_commits(version, remote_latest_version, commits).addCallbacks(vers_get_cb, result_d.errback)

                remote_indx_client.diff("diff", version).addCallbacks(diff_cb, result_d.errback) # NB: remote_latest_version is optional and implied.
                
            remote_indx_client.get_version().addCallbacks(version_cb, result_d.errback)

        self.root_store.query(query, depth = 1, render_json = False).addCallbacks(objs_cb, result_d.errback)
        return result_d

    def link_query(self):
        return {"type": NS_ROOT_BOX + "link",
                "boxes":
                    {"$and": [
                        {"box": self.root_store.boxid,
                         "server-url": self.url
                        }
                    ]}
               }

    def update_model_query(self, initial_query = False):
        """ Query the root box for root box objects and update the model of the root box here.
        
            This is called at init and also whenever any of the model objects (users/servers/boxes etc.) are in the diff.
        """
        logging.debug("IndxSync update_model_query on box {0}".format(self.root_store.boxid))
        result_d = Deferred()

        def objs_cb(graph):
            logging.debug("IndxSync update_model_query, objs_cb, graph: {0}".format(graph))
            
            if initial_query:
                # populate the watched_objs list
                self.watched_objs = graph.objects().keys()

            self.models = []

            for id in graph.root_object_ids:
                logging.debug("IndxSync update_model_query, root id: {0}".format(id))
                self.models.append(id)

            result_d.callback(True) # for the initial call to succeed

        # query for each link to this box on this server.
        self.root_store.query(self.link_query(), depth = 0, render_json = False).addCallbacks(objs_cb, result_d.errback)
        return result_d

