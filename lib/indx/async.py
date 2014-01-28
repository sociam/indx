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
from twisted.internet.defer import Deferred
import indx_pg2 as database
from indx.crypto import auth_keys
import indx.sync

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
            if data['action'] == "auth":

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
                    signature, key_hash, algo, method, appid = data['signature'], data['key_hash'], data['algo'], data['method'], data['appid']
                except Exception as e:
                    logging.error("ASync login_keys error getting all parameters.")
                    return self.send400()

                def win(resp):
                    # authenticated now - state of this isn't saved though, we get a token immediately instead

                    username, boxid = resp
                    password = "" # TODO double-check this
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
                                return self.send200(data = {"token": token.id})

                            token.get_store().addCallbacks(store_cb, lambda failure: self.send500())

                        self.webserver.tokens.new(username,password,boxid,appid,origin,self.clientip,self.webserver.server_id).addCallbacks(token_cb, lambda failure: self.send500())


                    self.webserver.database.lookup_best_acct(boxid, username, password).addCallbacks(got_acct, lambda conn: self.send401())


                def fail(empty):
                    self.send401()

                auth_keys(self.webserver.keystore, signature, key_hash, algo, method, self.sessionid).addCallbacks(win, fail)

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
            logging.error("WebSocketsHandler frameRecevied, error: {0}".format(e))
            self.send500()
            return

    def connectBackToClient(self, public_key_hash, store):
        """ Try to connect back through this websocket to the other side. """ 
        logging.debug("ASync connectBackToClient, using hash {0}".format(public_key_hash))
        # look up IndxSync object by  public_key_hash
        return_d = Deferred()

        # lookup model
        def model_cb(model_id):
            all_models = [model_id]
            self.webserver.sync_boxes(all_models = all_models, websocket = self).addCallbacks(return_d.callback, return_d.errback)

        self.get_model_by_key(public_key_hash, store).addCallbacks(model_cb, return_d.errback)
        return return_d

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
            for obj_id in graph.objects().keys():
                return_d.callback(obj_id)
                return

            return_d.errback(Exception("Could not find a model that uses the public key hash: {0}".format(public_key_hash)))

        store.query(query, render_json = False, depth = 0).addCallbacks(query_cb, return_d.errback)
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

            def observer(diff):
                """ Receive an update from the server. """
                logging.debug("WebSocketsHandler listen_diff observer notified: {0}".format(diff))

                self.sendJSON({"action": "diff", "operation": "update", "data": diff})

            store.listen(observer) # no callbacks, nothing to do

        self.token.get_store().addCallbacks(store_cb, err_cb)

    def sendJSON(self, data):
        """ Send data as JSON to the WebSocket. """
        logging.debug("ASync send JSON of data: {0}".format(data))
        encoded = cjson.encode(data)
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


