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
from indx.crypto import generate_rsa_keypair, rsa_encrypt, sha512_hash, load_key, make_encpk2
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
        self.models = {
        }

#        def observer(diff):
#            """ Root box callback function returning an update. """
#            logging.debug("IndxSync observer, notify: {0}".format(diff))
#
#            def err_cb(failure):
#                failure.trap(Exception)
#                logging.error("IndxSync observer error from diff: {0}".format(failure))
#
#            logging.debug("IndxSync observer diff: {0}".format(diff))
#
#            try:
#                diff = diff['data']
#                for obj in self.watched_objs:
#                    if obj in diff['added'] or obj in diff['deleted'] or obj in diff['changed']:
#                        logging.debug("IndxSync observer, ID '{0}' in watched objs found in the diff".format(obj))
#                        raise Exception("break")
#
#                for id, obj in diff['added'].items():
#                    if "type" in obj:
#                        for val in obj['type']:
#                            if val["@value"] in self.TYPES:
#                                logging.debug("IndxSync observer, type '{0}' in TYPES found in the diff".format(val["@value"]))
#                                raise Exception("break")
#                            
#
#                for verb in diff['changed']:
#                    for id, obj in diff['changed'][id]:
#                        if "type" in obj:
#                            for val in obj['type']:
#                                if val["@value"] in self.TYPES:
#                                    logging.debug("IndxSync observer, type '{0}' in TYPES found in the diff".format(val["@value"]))
#                                    raise Exception("break")
#
#            # breaking out of the loops, and then calling the query at the same time
#            except Exception as e:
#                # id was in watched items, or a diff object was added/changed with a type in the TYPES object
#
#                def updated_cb(response):
#                    # model updated, do a sync now
#                    logging.debug("IndxSync observer updated_cb")
#                    self.sync_boxes().addCallbacks(lambda foo: logging.debug("IndxSync observer updated_cb (post model-update) sync complete"), err_cb)
#
#                self.update_model_query().addCallbacks(lambda response: updated_cb, err_cb) # TODO use the callbacks here? (doesn't return anything)
#            else:
#                # only when the box doesn't need to be updated
#                # only sync this box, don't update the model first
#                self.sync_boxes().addCallbacks(lambda foo: logging.debug("IndxSync observer (no model-update) sync complete"), err_cb)
#
#        self.observer = observer

        def err_cb(failure):
            failure.trap()
            e = failure.value
            logging.error("IndxSync __init__ error querying box, raising: {0}".format(e))
            raise e

        def query_cb(results):
            logging.debug("IndxSync __init__ query_cb, results: {0}".format(results))
            # initial query finished, start listening to changes to the root box
            logging.debug("IndxSync query_cb, model: {0}".format(self.models))

            def sync_cb(empty):
                logging.debug("IndxSync __init__ sync_cb")
                # TODO anythign here? no need to listen to our own box..
                #root_store.listen(observer)

### removed, now if this is used, you haveto call it yourself.
#            self.sync_boxes().addCallbacks(sync_cb, err_cb)

        self.update_model_query(initial_query = True).addCallbacks(query_cb, err_cb)


    def destroy(self):
        """ Destroy this sync instance. Stops listening on the database, for example. """
#        self.root_store.unlisten(self.observer)


    def link_remote_box(self, local_user, local_pass, remote_address, remote_box, remote_token, server_id):
        """ Link a remote box with this local box (either a root box, or just a non-root synced box).

            Requires the credentials of the remote box, and will exchange keys using these credentials, store public keys of each box in the synced boxes, and then not require the credentials again in future to sync.
        """
        logging.debug("IndxSync link_remote_box, local: {0}, to remote: {1} @ {2}".format(self.root_store.boxid, remote_address, remote_box))
        return_d = Deferred()

        local_keys = generate_rsa_keypair(3072)
        local_encpk = make_encpk2(local_keys, local_pass)
#        local_encpk = rsa_encrypt(load_key(local_keys['public']), local_pass)

        def new_remote_key_cb(remote_keys):
            logging.debug("IndxSync link_remote_box, new_remote_key_cb, remote_keys: {0}".format(remote_keys))
            # NB: no "private" in remote_keys, that never leaves the remote box.
            remote_keys = remote_keys['data'] # remove the Indx HTTP response padding

            remote_encpk = remote_keys['encpk2']
            if type(remote_encpk) != type(""):
                remote_encpk = json.dumps(remote_encpk) 

            remote_serverid = remote_keys['serverid']

            link_uid = uuid.uuid1()
            local_key_uid = uuid.uuid1()
            remote_key_uid = uuid.uuid1()
            status1_uid = uuid.uuid1()
            status2_uid = uuid.uuid1()

            link_uri = "link-{0}".format(link_uid)
            status1_uri = "status-{0}".format(status1_uid)
            status2_uri = "status-{0}".format(status2_uid)

            # objects get updated to local box, and then synced across to the other boxes once the syncing starts
            new_objs = [
                {   "@id": link_uri,
                    "type": [ {"@value": NS_ROOT_BOX + "link"} ],
                    "boxes": [ {"@id": "box-{0}".format(local_key_uid)}, # links to the objs below
                               {"@id": "box-{0}".format(remote_key_uid)}, # links to the objs below
                             ],
                    "statuses": [ {"@id": status1_uri}, {"@id": status2_uri} ],
                },
                { "@id": status1_uri,
                  "type": [ {"@value": NS_ROOT_BOX + "status"} ],
                  "src-boxid": [ {"@value": remote_box} ],
                  "src-server-url": [ {"@value": remote_address} ],
                  "dst-boxid": [ {"@value": self.root_store.boxid} ],
                  "dst-server-url": [ {"@value": self.url} ],
                },
                { "@id": status2_uri,
                  "type": [ {"@value": NS_ROOT_BOX + "status"} ],
                  "dst-boxid": [ {"@value": remote_box} ],
                  "dst-server-url": [ {"@value": remote_address} ],
                  "src-boxid": [ {"@value": self.root_store.boxid} ],
                  "src-server-url": [ {"@value": self.url} ],
                },
                {   "@id": "box-{0}".format(local_key_uid),
                    "type": [ {"@value": NS_ROOT_BOX + "box"} ],
                    "server-url": [ {"@value": self.url } ],
                    "server-id": [ {"@value": server_id } ],
                    "box": [ {"@value": self.root_store.boxid} ],
                    "key": [ {"@id": local_keys['public-hash']}], # links to the key objs below
                },
                {   "@id": "box-{0}".format(remote_key_uid),
                    "type": [ {"@value": NS_ROOT_BOX + "box"} ],
                    "server-url": [ {"@value": remote_address } ],
                    "server-id": [ {"@value": remote_serverid } ],
                    "box": [ {"@value": remote_box} ],
                    "key": [ {"@id": remote_keys['public-hash']}], # links to the key objs below
                },
                {   "@id": local_keys['public-hash'],
                    "type": [ {"@value": NS_ROOT_BOX + "key"} ],
                    "public-key": [ {"@value": local_keys['public']} ], # share the full public keys everywhere (private keys only in respective server's keystores)
                    "public-hash": [ {"@value": local_keys['public-hash']} ], # share the full public keys everywhere (private keys only in respective server's keystores)
                },
                {   "@id": remote_keys['public-hash'],
                    "type": [ {"@value": NS_ROOT_BOX + "key"} ],
                    "public-key": [ {"@value": remote_keys['public']} ], # share the full public keys everywhere
                    "public-hash": [ {"@value": remote_keys['public-hash']} ], # share the full public keys everywhere
                },
            ]


            def encpk_cb(empty):

                def local_added_cb(empty):
                    logging.debug("IndxSync link_remote_box, local_added_cb")

                    def ver_cb(ver):
                        logging.debug("IndxSync link_remote_box, ver_cb {0}".format(ver))
                        # add new objects to local store

                        def added_cb(response):

                            def added_indx_cb(empty):
                                # start syncing/connecting using the new key
                                self.sync_boxes([link_uri], include_push_all = True).addCallbacks(lambda empty: return_d.callback(remote_keys['public']), return_d.errback)

                            self.database.save_linked_box(self.root_store.boxid).addCallbacks(added_indx_cb, return_d.errback)

                        self.root_store.update(new_objs, ver).addCallbacks(added_cb, return_d.errback)

                    self.root_store._get_latest_ver().addCallbacks(ver_cb, return_d.errback)

                # add the local key to the local store
                self.keystore.put(local_keys, local_user, self.root_store.boxid).addCallbacks(local_added_cb, return_d.errback) # store in the local keystore

            # don't save the local encpk2 here, only give it to the remote server.
            # save the remote encpk2
            self.database.save_encpk2(sha512_hash(remote_encpk), remote_encpk, remote_serverid).addCallbacks(encpk_cb, return_d.errback)


        client = IndxClient(remote_address, remote_box, self.APPID, token = remote_token)
        client.generate_new_key(local_keys, local_encpk, server_id).addCallbacks(new_remote_key_cb, return_d.errback)

        return return_d


    def sync_boxes(self, all_models = None, websocket = None, include_push_all = False):
        """ Synchronise boxes based on the internal model stored in this object.
        
            all_models - A list of model IDs to synchronise. If None, do them all.
            websocket - A websocket object to use, instead of creating a new one.
            include_push_all - Push the current data to the remote server too? (Default don't). This is for bootstrapping a new server.
        """
        # TODO in future make include_push_all read the last_version_seen from the remote server statuses entry, and send from there.
        logging.debug("IndxSync sync_boxes, all_models: {0}".format(all_models))
        return_d = Deferred()

        if all_models is None:
            all_models = copy.copy(self.models)

        def next_model(empty):
            logging.debug("IndxSync sync_boxes next_model")

            if len(all_models) < 1:
                return_d.callback(True)
                return

            model_id = all_models.pop(0)
            logging.debug("IndxSync sync_boxes next_model model_id: {0}")

            def model_cb(model_graph):
                logging.debug("IndxSync sync_boxes model_cb, model_graph: {0}".format(model_graph.to_json()))

                def expanded_cb(empty):
                    logging.debug("IndxSync sync_boxes expanded_cb, model_graph: {0}".format(model_graph.to_json()))
                    model = model_graph.get(model_id)

                    # get up-to-date required information from the synced box
                    remote_server_url = None
                    remote_box = None
                    local_key_hash = None

                    for box_obj in model.get("boxes"):
                        box = model_graph.get(box_obj.id) # XXX this is a workaround to a bug in the types code - we shouldn't have to re-get the object
                        logging.debug("IndxSync sync_boxes model_cb: box {0}".format(box.to_json()))

                        boxid = box.getOneValue("box")

                        logging.debug("IndxSync sync_boxes, box value: {0}, local boxid: {1}".format(boxid, self.root_store.boxid))

                        if boxid != self.root_store.boxid:
                            logging.debug("IndxSync sync_boxes model_cb: remote box")
                            # remote box
                            remote_server_url = box.getOneValue("server-url")
                            remote_server_id = box.getOneValue("server-id")
                            remote_box = boxid
                        else:
                            logging.debug("IndxSync sync_boxes model_cb: local box")
                            # local box
                            local_key_obj = model_graph.get(box.getOne("key").id) # XXX this is a workaround to a bug in the types code - we shouldn't have to re-get the object

                            local_key_hash = local_key_obj.getOneValue("public-hash")


                    def encpk2_cb(remote_encpk2):

                        def keystore_cb(local_key):
                            # start sync 
                            clientauth = IndxClientAuth(remote_server_url, self.APPID)


                            def authed_cb(empty):
                                logging.debug("IndxSync sync_boxes authed_cb")

                                def token_cb(remote_token):
                                    logging.debug("IndxSync sync_boxes token_cb")
                                    client = IndxClient(remote_server_url, remote_box, self.APPID, client = clientauth.client, token = remote_token)
                                    
                                    def updated_cb(empty):

                                        def pushed_cb(empty):

                                            def observer(data):

                                                if data.get('action') == 'diff' and data.get('operation') == 'update':
                                                    diff = data['data']

                                                    def done_cb(empty):
                                                        logging.debug("IndxSync updating from a websocket done.")
                                                    def err_cb(failure):
                                                        logging.error("IndxSync updating from a websocket error: {0}".format(failure))

                                                    self.update_to_latest_version(client, remote_server_url, remote_box, diff_in = diff).addCallbacks(done_cb, err_cb)                                  
                                                else:
                                                    logging.error("Sync: Unknown data message from WebSocket: {0}".format(data))

                                            # auths and sets up listening for diffs, filtering them and passing them to the observer
                                            if websocket is None:
                                                wsclient = client.connect_ws(local_key['key']['private'], local_key_hash, observer, remote_encpk2) # open a new socket
                                            else:
                                                websocket.listen_diff(observer) # use an existing websocket

                                            next_model(None)

                                        if not include_push_all:
                                            pushed_cb(None)
                                            return
                                        
                                        # push the whole box to the remote box
                                        def latest_cb(graph):
                                            def ver_cb(version):
                                                client.update_raw(version, graph.to_flat_json()).addCallbacks(pushed_cb, return_d.errback)

                                            client.get_version().addCallbacks(lambda resp: ver_cb(resp['data']), return_d.errback)

                                        self.root_store.get_latest(render_json = False).addCallbacks(latest_cb, return_d.errback)

                                    # compare local version to previous, and update one of them, or both
                                    self.update_to_latest_version(client, remote_server_url, remote_box).addCallbacks(updated_cb, return_d.errback)

                                clientauth.get_token(remote_box).addCallbacks(token_cb, return_d.errback)
     
                            clientauth.auth_keys(local_key['key']['private'], local_key_hash, remote_encpk2).addCallbacks(authed_cb, return_d.errback)

                        self.keystore.get(local_key_hash).addCallbacks(keystore_cb, return_d.errback)

                    self.database.lookup_encpk2(remote_server_id).addCallbacks(encpk2_cb, return_d.errback)
                    
                model_graph.expand_depth(5, self.root_store).addCallbacks(expanded_cb, return_d.errback)

            self.root_store.get_latest_objs([model_id], render_json = False).addCallbacks(model_cb, return_d.errback)

        next_model(None)
        return return_d


    def update_to_latest_version(self, remote_indx_client, remote_server_url, remote_box, diff_in = None):
        """ Get the last version seen (consumed) of a remote box. """
        logging.debug("IndxSync update_to_latest_version of server {0} and box {1}".format(remote_server_url, remote_box))

        # updates the local box to the latest version of the remote box

        result_d = Deferred()

        query = { "type": NS_ROOT_BOX + "status",
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
                status_id = id
                version = int(status.getOneValue("last-version-seen") or "0")
                break

            if status_id is None:
                status_id = uuid.uuid1()

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
                    commits = diff_resp['@commits']

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

                        def applied_diff_cb(resp):
                            # update the 'status' object (with @id == 'status_id', above) with the last-version-seen to be 'remote_latest_version'
                            new_version = resp['@version']

                            status_obj = { "@id": status_id,
                                           "last-version-seen": [ {"@value": remote_latest_version} ], # the update
                                           "type": [ {"@value": NS_ROOT_BOX + "status"} ],
                                           "src-boxid": [ {"@value": remote_box} ],
                                           "src-server-url": [ {"@value": remote_server_url} ],
                                           "dst-boxid": [ {"@value": self.root_store.boxid} ],
                                           "dst-server-url": [ {"@value": self.url} ],
                                         }

                            def status_cb(empty):
                                self.root_store.store_commits(commits).addCallbacks(result_d.callback, result_d.errback)

                            self.root_store.update([status_obj], new_version).addCallbacks(status_cb, result_d.errback)

                        # apply diff
                        self.root_store.apply_diff(diff, commits.keys()).addCallbacks(applied_diff_cb, result_d.errback)
                        
                    self.root_store._vers_without_commits(version, remote_latest_version, commits.keys()).addCallbacks(vers_get_cb, result_d.errback)

                if diff_in is None:
                    remote_indx_client.diff("diff", version).addCallbacks(diff_cb, result_d.errback) # NB: remote_latest_version is optional and implied.
                else:
                    diff_cb(diff_in)
                
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

