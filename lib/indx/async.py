#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
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
import cjson
import traceback
import StringIO
import uuid
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
import indx_pg2 as database
from indx.crypto import auth_keys, rsa_sign
import indx.sync
from indx.reactor import IndxRequest

class IndxAsync:
    """ Abstracted logic for the INDX aynchronous (i.e. WebSocket) server. """

    def __init__(self, send_f, webserver, clientip):
        self.send_f = send_f # send messages function reference
        self.webserver = webserver
        self.clientip = clientip
        self.listeners = {}

    def receive(self, frame):
        """ Send data here when it is received from the real transport. """
        try:
            def err_cb(failure):
                logging.error("WebSocketsHandler receive, err_cb: {0}".format(failure))
            
            data = json.loads(frame)
            requestid = data.get("requestid")

            if data.get("action") == "diff" and data.get("operation") == "update":
                # received after login_keys succeeds and we send the diff/start message
                self.remote_observer(data)
                return
            if data.get("action") == "http":
                # a call to an http request, over the websocket (via the reactor mappings)
                logging.debug("Async got an http request, data: {0}".format(data))

                request = data.get("request")
                #session = data.get("sessionid")
                session = None

                #if session is None:
                #    return self.send400(requestid, "http", data = {"error": "'sessionid' required in 'http'" })

                #session = self.sessionid # TODO enable multiple sessions per websocket
                logging.debug("Async got an http request: {0} in session {1}".format(request, session))

                def req_cb(response):
                    logging.debug("ASync sending http response in session: {0}".format(session))
                    frame = {"respond_to": "http", "response": response.to_json()}
                    if session is not None:
                        frame['session'] = session

                    self.sendJSON(requestid, frame, "http")

                base_path = request.get("path")
                if base_path[0] == "/":
                    base_path = base_path[1:]

                indx_request = IndxRequest(
                    request.get("uri"),
                    request.get("method"),
                    base_path.split("/")[0], # e.g. box name / or auth/admin
                    request.get("path"),
                    request.get("params"),
                    request.get("content"),
                    session,
                    req_cb,
                    self.clientip
                )

                self.webserver.indx_reactor.incoming(indx_request)
                return
            elif data.get("action") == "echo":
                logging.debug("Async got an echo request: {0}".format(data))
                self.sendJSON(requestid, {}, "echo")
                return
            elif data.get("action") == "response":
                if data.get('respond_to') == "login_keys":
                    # a response to our attempt to re-connect back to the client
                    logging.debug("Async got a respond to login_keys: {0}".format(data))
                    # TODO handle errors
                    self.sendJSON(requestid, {"action": "diff", "operation": "start"}, "login_keys") 
                    return
                else:
                    respond_to = data.get("respond_to") # could be None
                    self.send400(requestid, data.get("action"), data = {"error": "'respond_to' value of '{0}' is unknown for action 'response'.".format(respond_to)})
                    return
            elif data['action'] == "auth":

                def token_cb(token):
                    try:    
                        if token is None:
                            self.send401(requestid, "auth")
                            return
                        logging.debug("WebSocketsHandler Auth by Token {0} successful.".format(data['token']))
                        self.tokens[data['token']] = token
                        
                        # also tell the webserver we just got a successful auth from an outside client via websocket
                        # so it can try to connect back over this websocket.
#                        self.webserver.

                        self.send200(requestid, "auth")
                        return
                    except Exception as e:
                        logging.error("WebSocketsHandler frameReceived, token error: {0}".format(e))
                        self.send401(requestid, "auth")
                        return

                self.tokenkeeper.get(data['token']).addCallbacks(token_cb, err_cb)
#            elif data['action'] == "get_session_id":
#                self.send200(requestid, "auth", data = {'sessionid': self.sessionid})
                return
            elif data['action'] == "login_keys":
                if requestid is None:
                    return self.send400(requestid, "login_keys", data = {"error": "'requestid' required for action 'login_keys'"})

                try:
                    signature, key_hash, algo, method, appid, encpk2 = data['signature'], data['key_hash'], data['algo'], data['method'], data['appid'], data['encpk2']
                except Exception as e:
                    logging.error("ASync login_keys error getting all parameters.")
                    return self.send400(requestid, "login_keys")

                def win(resp):
                    # authenticated now - state of this isn't saved though, we get a token immediately instead

                    username, password, boxid = resp
                    origin = "/ws" # TODO double-check this
                    # get token, return that

                    def got_acct(acct):
                        if acct == False:
                            return self.send401(requestid, "login_keys")

                        db_user, db_pass = acct

                        def token_cb(token):

                            def store_cb(store):
                                # success, send token back to user
                                # first, try to connect back through the websocket
                                self.tokens[token.id] = token
                                self.connectBackToClient(key_hash, store).addCallbacks(lambda empty: logging.debug("ASync, success connecting back."), lambda failure: logging.error("ASync, failure connecting back: {0}".format(failure)))
                                return self.send200(requestid, "login_keys", data = {"token": token.id})

                            token.get_store().addCallbacks(store_cb, lambda failure: self.send500(requestid, "login_keys"))

                        self.webserver.tokens.new(username,password,boxid,appid,origin,self.clientip,self.webserver.server_id).addCallbacks(token_cb, lambda failure: self.send500(requestid, "login_keys"))


                    self.webserver.database.lookup_best_acct(boxid, username, password).addCallbacks(got_acct, lambda conn: self.send401(requestid, "login_keys"))

                def fail(empty):
                    self.send401(requestid, "login_keys")

                auth_keys(self.webserver.keystore, signature, key_hash, algo, method, requestid, encpk2).addCallbacks(win, fail)
                return
            elif data['action'] == "diff":
                # turn on/off diff listening
                token = data.get("token")
                if token is None:
                    return self.send400(requestid, "diff", data = {"error": "'token' required for diff"})

                diffid = data.get("diffid")
                if diffid is None and data.get("operation") != 'start': # only 'start' is allowed to not have a diffid
                    return self.send400(requestid, "diff", data = {"error": "'diffid' required for diff"})
                elif diffid not in self.listeners:
                    return self.send400(requestid, "diff", data = {"error": "Existing diff with diffid '{0}' does not exist".format(diffid)})


                def diffok_cb(operation):
                    logging.debug("WebSocketsHandler diff action response: {0}".format(operation))
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})

                def diff_err_cb(failure):
                    logging.error("WebSocketsHandler diff action error: {0}".format(failure.value))
                    failure.trap(Exception)
                    self.send400(requestid, "diff", data = {"error": "{0}".format(failure.value)})

                try:
                    operation = data.get("operation").lower()
                except Exception as e:
                    return self.send400(requestid, "diff", data = {"error": "no valid 'operation' found."})


                # check that the 'ids' field is present and an array - sends a 400 back if not
                def check_ids():
                    if not data.get("ids") or type(data.get("ids")) != type([]):
                        self.send400(requestid, "diff", data = {"error": "This action and operation requires an 'ids' field as an array of object IDs."})
                        return False
                    return True

                # operation functions
                def op_start():
                    diffid = "{0}".format(uuid.uuid1()) # generate new diffid

                    def store_cb(store):
                        self.listeners[diffid] = IndxDiffListener(store, requestid, diffid, self.sendJSON)
                        self.listeners[diffid].subscribe().addCallbacks(diffok_cb, diff_err_cb)

                    self.get_store_from_tokenid(token).addCallbacks(store_cb, diff_err_cb)

                def op_stop():
                    self.listeners[diffid].unsubscribe()
                    del self.listeners[diffid]
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})

                def op_addids():
                    if not check_ids():
                        return

                    self.listeners[diffid].addIDs(data.get("ids"))
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})

                def op_setids():
                    if not check_ids():
                        return

                    self.listeners[diffid].setIDs(data.get("ids"))
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})
                
                def op_removeids():
                    if not check_ids():
                        return

                    self.listeners[diffid].removeIDs(data.get("ids"))
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})

                def op_setquery():
                    if not data.get("query") or type(data.get("query")) != type(""):
                        return self.send400(requestid, "diff", data = {"error": "This action and operation requires a string 'query' field."})

                    self.listeners[diffid].setQuery(data.get("query"))
                    self.send200(requestid, "diff", data = {"diffid": diffid, "respond_to": "diff/{0}".format(operation)})

                ops = {
                    "start": op_start,
                    "stop": op_stop,
                    "addids": op_addids,
                    "setids": op_setids,
                    "removeids": op_removeids,
                    "setquery": op_setquery,
                }

                if operation in ops:
                    return ops[operation]()
                else:
                    return self.send400(requestid, "diff", data = {"error": "no valid 'operation' found."})
            else:
                action = data.get("action") # could be None
                return self.send400(requestid, action, data = {"error": "'action' value of '{0}' is unknown".format(action)})
        except Exception as e:
            logging.error("WebSocketsHandler frameRecevied, error: {0},\n trace: {1}".format(e, traceback.format_exc()))
            return self.send500(requestid, data.get("action"))

    def connectBackToClient(self, public_key_hash, store):
        """ Try to connect back through this websocket to the other side. """ 
        logging.debug("ASync connectBackToClient, using hash {0}".format(public_key_hash))
        # look up IndxSync object by  public_key_hash
        return_d = Deferred()

        # lookup model
        def model_cb(resp):
            model_id, boxid = resp
            all_models = [model_id]

            def sync_cb(indxsync):
                indxsync.sync_boxes(all_models = all_models, websocket = self).addCallbacks(return_d.callback, return_d.errback)

            self.webserver.sync_box(boxid).addCallbacks(sync_cb, return_d.errback)

        self.get_model_by_key(public_key_hash, store).addCallbacks(model_cb, return_d.errback)
        return return_d


    def listen_remote(self, private_key, key_hash, observer, remote_encpk2):
        self.remote_observer = observer 
        keyauth = {"key_hash": key_hash, "private_key": private_key, "encpk2": remote_encpk2}

        try:
            SSH_MSG_USERAUTH_REQUEST = "50"
            method = "publickey"
            algo = "SHA512"

            key_hash, private_key, encpk2 = keyauth['key_hash'], keyauth['private_key'], keyauth['encpk2']
            if not (type(encpk2) == type("") or type(encpk2) == type(u"")):
                encpk2 = json.dumps(encpk2)

            requestid = "{0}".format(uuid.uuid1())

            ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, requestid, method, algo, key_hash)
            signature = rsa_sign(private_key, ordered_signature_text)

            values = {"action": "login_keys", "signature": signature, "key_hash": key_hash, "algo": algo, "method": method, "appid": "INDX ASync", "encpk2": encpk2}

            self.sendJSON(None, values, None)

        except Exception as e:
            logging.error("ASync: {0}".format(e))


    def get_model_by_key(self, public_key_hash, store):
        """ Get the ID of a 'link' object, based on the hash of a public key it uses.

            Public keys are not reused, so it will only match one.
        """
        return_d = Deferred()

        query = {"type": indx.sync.NS_ROOT_BOX + "link",
                 "boxes":
                     {"key":
                         {"public-hash": public_key_hash}
                     }
                }
       
        def query_cb(graph):
            modelid, boxname = None, None

            for obj_id, obj in graph.root_objects().items():
                modelid = obj_id

                for box in graph.get(obj_id).get("boxes"):
                    for key in graph.get(box.id).get("key"):
                        public_hash = graph.get(key.id).getOneValue("public-hash")

                        if public_hash != public_key_hash: # pick the box that doesn't match the key, i.e. our box
                            boxname = graph.get(box.id).getOneValue("box")
                            return_d.callback((modelid, boxname))
                            return

            return_d.errback(Exception("Could not find a model that uses the public key hash: {0}".format(public_key_hash)))

        store.query(query, render_json = False, depth = 4).addCallbacks(query_cb, return_d.errback)
        return return_d

        
    def connected(self):
        """ Called by WebSocketsHandler when the connection is completed through the real transport. """
        # TokenKeeper from the webserver. The "webserver" attribtue in site is added in server.py when we create the WebSocketsSite.
        self.tokenkeeper = self.webserver.tokens
        self.tokens = {} # tokenid -> token object
        self.send200(None, "connect", data = {})

    def get_store_from_tokenid(self, tokenid):
        return_d = Deferred()

        token = self.tokens.get(tokenid)

        if token is None:
            return_d.errback(Failure(Exception("token invalid (it must be authed successfully to this websocket to use it here)")))
            return return_d

        token.get_store().addCallbacks(return_d.callback, return_d.errback)
        return return_d

#    def listen_diff(self, requestid, tokenid, diffid):
#        return_d = Deferred()
#
#        def store_cb(store):
#            logging.debug("WebSocketsHandler listen_diff, store_cb: {0}".format(store))
#
#            def observer_local(diff):
#                """ Receive an update from the server. """
#                logging.debug("WebSocketsHandler listen_diff observer notified: {0}".format(diff))
#                self.sendJSON(requestid, {"action": "diff", "diffid": diffid, "operation": "update", "data": diff}, "diff")
#
#            try:
#                store.listen(observer_local, diffid) # no callbacks, nothing to do
#            except Exception as e:
#                logging.error("WebSocketsHandler listen_diff error listening to store: {0}".format(e))
#                return return_d.errback(Failure(e))
#
#            return_d.callback(True) # much success
#
#        self.get_store_from_tokenid(tokenid).addCallbacks(store_cb, return_d.errback)
#        return return_d
#
#    def stop_diff(self, requestid, tokenid, diffid):
#        """ Unsubscribe a diff, by ID. """
#        return_d = Deferred()
#
#        def store_cb(store):
#            logging.debug("WebSocketsHandler stop_diff, store_cb: {0}".format(store))
#
#            try:
#                store.unlisten(diffid) # no callbacks, nothing to do
#            except Exception as e:
#                logging.error("WebSocketsHandler listen_diff error listening to store: {0}".format(e))
#                return return_d.errback(Failure(e))
#
#            return_d.callback(True) # much success
#
#        self.get_store_from_tokenid(tokenid).addCallbacks(store_cb, return_d.errback)
#        return return_d



    def sendJSON(self, requestid, data, respond_to = None):
        """ Send data as JSON to the WebSocket. """
        logging.debug("ASync send JSON of data: {0}, requestid: {1}".format(data, requestid))
        #encoded = cjson.encode(data)

        try:
            if requestid:
                data.update({"requestid": requestid})

            if respond_to:
                data.update({"respond_to": respond_to})

            encoded = json.dumps(data)
            self.send_f(encoded)
        except Exception as e:
            logging.error("Async error sending JSON: {0}".format(e))

    def send500(self, requestid, respond_to, data = None):
        out = {"success": False, "error": "500 Internal Server Error"}
        if data is not None:
            out.update(data)
        self.sendJSON(requestid, out, respond_to)

    def send400(self, requestid, respond_to, data = None):
        out = {"success": False, "error": "400 Bad Request"}
        if data is not None:
            out.update(data)
        self.sendJSON(requestid, out, respond_to)

    def send401(self, requestid, respond_to, data = None):
        out = {"success": False, "error": "401 Unauthorized"}
        if data is not None:
            out.update(data)
        self.sendJSON(requestid, out, respond_to)

    def send200(self, requestid, respond_to, data = None):
        out = {"success": True}
        if data is not None:
            out.update(data)
        self.sendJSON(requestid, out, respond_to)


class IndxDiffListener:
    """ Listens for diffs from the store, filters them and sends frames back to the client.
    """

    def __init__(self, store, requestid, diffid, sendJSON):
        self.store = store
        self.requestid = requestid
        self.diffid = diffid
        self.sendJSON = sendJSON # function reference to send JSON down the right websocket

        self.ids = set() # set to limit to these IDs only
        self.query = None # limit to objects that match this query only, either the version before the diff or the version after
        self.previousIds = set() # set of ids that match the query at the previous version

        def ids_cb(ids):
            self.previousIds = ids

        def err_cb(failure):
            failure.trap(Exception)
            logging.error("Exception while querying store in IndxDifflistener: {0}".format(failure))

        self.runQuery.addCallbacks(ids_cb, err_cb)

    def filterDiff(self, diff, id_filter):
        """ Filter this diff to only include IDs in this set. """
        for id_d in diff['deleted']:
            if id_d not in id_filter:
                del diff['deleted'][id_d]

        fields = ['added', 'changed']
        for field in fields:
            for id_f in diff[field].keys():
                if id_f not in id_filter:
                    del diff[field][id_f]

        return diff

    def isEmptyDiff(self, diff):
        """ Check if diff is empty. """
        return not( len(diff['deleted']) == 0 and len(diff['added'].keys()) == 0 and len(diff['changed'].keys()) == 0 )

    def observer(self, diff, query_results):
        """ query_results is a list of IDs that match the query. """

        query_result_set = set(query_results)

        id_filter = self.previousIds | query_result_set | self.ids # set of IDs to filter by - anything in the query results (prev and current) or ids

        filtered_diff = self.filterDiff(diff, id_filter)

        if not self.isEmptyDiff(filtered_diff):
            self.sendJSON(self.requestid, {"action": "diff", "diffid": self.diffid, "operation": "update", "data": filtered_diff}, "diff")

        self.previousIds = query_result_set

    def subscribe(self):
        
        def err_cb(failure):
            failure.trap(Exception)
            logging.error("Exception while querying store in IndxDifflistener: {0}".format(failure))

        def subscribe_cb(ids):
            """ Returns the IDs in the query at this version. """
            self.previousIDs = set(ids)

        self.store.listen(self).addCallbacks(subscribe_cb, err_cb)

    def unsubscribe(self):
        self.store.unlisten(self)

    def addIDs(self, ids):
        map(lambda id: self.ids.add(id), ids)

    def removeIDs(self, ids):
        map(lambda id: self.ids.remove(id), ids)

    def setIDs(self, ids):
        self.ids = ids

    def setQuery(self, query):
        if query != "":
            self.query = query
        else:
            self.query = None

    def runQuery(self):
        """ Runs the query on the existing store. """
        return_d = Deferred()

        def query_cb(graph):
            ids = graph.get_objectids()
            return_d.callback(ids)

        self.store.query(self.query, render_json=False, depth=0).addCallbacks(query_cb, return_d.errback)
        return return_d


