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

class IndxAsync:
    """ Abstracted logic for the INDX aynchronous (i.e. WebSocket) server. """

    def __init__(self, send_f, webserver):
        self.send_f = send_f # send messages function reference
        self.webserver = webserver

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
                        self.send200()
                        return
                    except Exception as e:
                        logging.error("WebSocketsHandler frameReceived, token error: {0}".format(e))
                        self.send401()
                        return

                self.tokens.get(data['token']).addCallbacks(token_cb, err_cb)
            elif data['action'] == "diff":
                # turn on/off diff listening
                if data['operation'] == "start":
                    self.listen_diff()
                    return
                elif data['operation'] == "stop":
                    #self.stop_listen()
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

    def connected(self):
        """ Call this when the connected is made through the real transport. """
        # TokenKeeper from the webserver. The "webserver" attribtue in site is added in server.py when we create the WebSocketsSite.
        self.tokens = self.webserver.tokens
        self.token = None

    def listen_diff(self):
        def err_cb(failure):
            logging.error("WebSocketsHandler listen_diff, err_cb: {0}".format(failure))

        def store_cb(store):
            logging.debug("WebSocketsHandler listen_diff, store_cb: {0}".format(store))

            def observer(diff):
                """ Receive an update from the server. """
                logging.debug("WebSocketsHandler listen_diff observer notified: {0}".format(diff))

                self.sendJSON({"action": "diff", "data": diff})

            store.listen(observer) # no callbacks, nothing to do

        self.token.get_store().addCallbacks(store_cb, err_cb)

    def sendJSON(self, data):
        """ Send data as JSON to the WebSocket. """
        encoded = cjson.encode(data)
        self.send_f(encoded)

    def send500(self):
        self.sendJSON({"success": False, "error": "500 Internal Server Error"})

    def send400(self):
        self.sendJSON({"success": False, "error": "400 Bad Request"})

    def send401(self):
        self.sendJSON({"success": False, "error": "401 Unauthorized"})

    def send200(self):
        self.sendJSON({"success": True})


