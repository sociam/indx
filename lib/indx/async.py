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
from twisted.internet.defer import Deferred
import indx_pg2 as database
from indx.crypto import auth_keys, rsa_sign
import indx.sync
from indx.reactor import IndxRequest

class IndxAsync:
    """ Abstracted logic for the INDX aynchronous (i.e. WebSocket) server. """

    def __init__(self, send_f, webserver, sessionid, clientip):
        self.send_f = send_f # send messages function reference
        self.webserver = webserver
        self.sessionid = sessionid
        self.clientip = clientip

    def receive(self, frame):
        """ Send data here when it is received from the real transport. """
        try:
            def err_cb(failure):
                logging.error("WebSocketsHandler receive, err_cb: {0}".format(failure))
            


            data = json.loads(frame)
            if data.get("action") == "diff" and data.get("operation") == "update":
                # received after login_keys succeeds and we send the diff/start message
                self.remote_observer(data)
                return

            if data.get("action") == "http":
                # a call to an http request, over the websocket (via the reactor mappings)
                logging.debug("Async got an http request, data: {0}".format(data))

                request = data.get("request")
                requestid = data.get("requestid")

                #session = data.get("session")
                session = self.sessionid # TODO enable multiple sessions per websocket
                logging.debug("Async got an http request: {0} in session {1}".format(request, session))

                def req_cb(response):
                    logging.debug("ASync sending http response in session: {0}".format(session))
                    self.sendJSON({"requestid": requestid, "respond_to": "http", "session": session, "response": response.to_json()})

                indx_request = IndxRequest(
                    request.get("uri"),
                    request.get("method"),
                    request.get("path"),
                    request.get("params"),
                    StringIO.StringIO(request.get("content")),
                    session,
                    req_cb,
                    self.clientip
                )

                self.webserver.indx_reactor.incoming(indx_request)
                return

            elif data.get('respond_to') == "login_keys":
                # a response to our attempt to re-connect back to the client
                logging.debug("Async got a respond to login_keys: {0}".format(data))
                # TODO handle errors
                self.sendJSON({"action": "diff", "operation": "start"}) 
                return

            elif data['action'] == "auth":

                def token_cb(token):
                    try:    
                        if token is None:
                            self.send401()
                            return
                        logging.debug("WebSocketsHandler Auth by Token {0} successful.".format(data['token']))
                        self.token = token
                        
                        # also tell the webserver we just got a successful auth from an outside client via websocket
                        # so it can try to connect back over this websocket.
#                        self.webserver.

                        self.send200()
                        return
                    except Exception as e:
                        logging.error("WebSocketsHandler frameReceived, token error: {0}".format(e))
                        self.send401()
                        return

                self.tokens.get(data['token']).addCallbacks(token_cb, err_cb)
            elif data['action'] == "get_session_id":
                self.send200(data = {'sessionid': self.sessionid})
            elif data['action'] == "login_keys":
                try:
                    signature, key_hash, algo, method, appid, encpk2 = data['signature'], data['key_hash'], data['algo'], data['method'], data['appid'], data['encpk2']
                except Exception as e:
                    logging.error("ASync login_keys error getting all parameters.")
                    return self.send400()

                def win(resp):
                    # authenticated now - state of this isn't saved though, we get a token immediately instead

                    username, password, boxid = resp
                    origin = "/ws" # TODO double-check this
                    # get token, return that

                    def got_acct(acct):
                        if acct == False:
                            return self.send401()

                        db_user, db_pass = acct

                        def token_cb(token):

                            def store_cb(store):
                                # success, send token back to user
                                # first, try to connect back through the websocket
                                self.token = token
                                self.connectBackToClient(key_hash, store).addCallbacks(lambda empty: logging.debug("ASync, success connecting back."), lambda failure: logging.error("ASync, failure connecting back: {0}".format(failure)))
                                return self.send200(data = {"token": token.id, "respond_to": "login_keys"})

                            token.get_store().addCallbacks(store_cb, lambda failure: self.send500())

                        self.webserver.tokens.new(username,password,boxid,appid,origin,self.clientip,self.webserver.server_id).addCallbacks(token_cb, lambda failure: self.send500())


                    self.webserver.database.lookup_best_acct(boxid, username, password).addCallbacks(got_acct, lambda conn: self.send401())

                def fail(empty):
                    self.send401()

                auth_keys(self.webserver.keystore, signature, key_hash, algo, method, self.sessionid, encpk2).addCallbacks(win, fail)

            elif data['action'] == "diff":
                # turn on/off diff listening
                if data['operation'] == "start":
                    self.listen_diff()
                    self.send200()
                    return
                elif data['operation'] == "stop":
                    #self.stop_listen()
                    self.send200()
                    return
                else:
                    self.send400()
                    return
            else:
                self.send400()
                return
        except Exception as e:
            logging.error("WebSocketsHandler frameRecevied, error: {0},\n trace: {1}".format(e, traceback.format_exc()))
            self.send500()
            return

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

            ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, self.sessionid, method, algo, key_hash)
            signature = rsa_sign(private_key, ordered_signature_text)

            values = {"action": "login_keys", "signature": signature, "key_hash": key_hash, "algo": algo, "method": method, "appid": "INDX ASync", "encpk2": encpk2}

            self.sendJSON(values)

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
        """ Call this when the connected is made through the real transport. """
        # TokenKeeper from the webserver. The "webserver" attribtue in site is added in server.py when we create the WebSocketsSite.
        self.tokens = self.webserver.tokens
        self.token = None

        # send the session ID when connection works
        self.send200(data = {'sessionid': self.sessionid})

    def listen_diff(self):
        def err_cb(failure):
            logging.error("WebSocketsHandler listen_diff, err_cb: {0}".format(failure))

        def store_cb(store):
            logging.debug("WebSocketsHandler listen_diff, store_cb: {0}".format(store))

            def observer_local(diff):
                """ Receive an update from the server. """
                logging.debug("WebSocketsHandler listen_diff observer notified: {0}".format(diff))

                self.sendJSON({"action": "diff", "operation": "update", "data": diff})

            store.listen(observer_local) # no callbacks, nothing to do

        self.token.get_store().addCallbacks(store_cb, err_cb)

    def sendJSON(self, data):
        """ Send data as JSON to the WebSocket. """
        logging.debug("ASync send JSON of data: {0}".format(data))
        #encoded = cjson.encode(data)
        encoded = json.dumps(data)
        self.send_f(encoded)

    def send500(self):
        self.sendJSON({"success": False, "error": "500 Internal Server Error"})

    def send400(self):
        self.sendJSON({"success": False, "error": "400 Bad Request"})

    def send401(self):
        self.sendJSON({"success": False, "error": "401 Unauthorized"})

    def send200(self, data = None):
        out = {"success": True}
        if data is not None:
            out.update(data)
        self.sendJSON(out)


