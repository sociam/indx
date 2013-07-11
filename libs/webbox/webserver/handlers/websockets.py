#    This file is part of INDX.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging, json
from txWebSocket.websocket import WebSocketHandler

class WebSocketsHandler(WebSocketHandler):

    def __init__(self, transport):
        WebSocketHandler.__init__(self, transport)

#    def __del__(self):
#        pass

    def sendJSON(self, data):
        """ Send data as JSON to the WebSocket. """
        encoded = json.dumps(data)
        self.transport.write(encoded)

    def send500(self):
        self.sendJSON({"success": False, "error": "500 Internal Server Error"})

    def send400(self):
        self.sendJSON({"success": False, "error": "400 Bad Request"})

    def send401(self):
        self.sendJSON({"success": False, "error": "401 Unauthorized"})

    def send200(self):
        self.sendJSON({"success": True})

    def startListen(self):
        """ Start listening for changes to the database and send diffs when they occur. """
        logging.debug("WebSocketsHandler startListen().")

        def err_cb(failure):
            failure.trap(Exception)
            logging.error("WebSocketsHandler err_cb, error getting raw store: {0}".format(failure))
            # TODO inform the client?

        def store_cb(store):
            logging.debug("WebSocketsHandler startListen, store_cb: {0}".format(store))

            def observer(notify):
                """ Receive an update from the server. """
                logging.debug("WebSocketsHandler startListen observer notified: {0}".format(notify))

                def err_cb(failure):
                    # send something to client?
                    failure.trap(Exception)
                    logging.error("WebSocketsHandler startListen observer error from diff: {0}".format(failure))

                def diff_cb(data):
                    logging.debug("WebSocketsHandler startListen observer diff: {0}".format(data))
                    self.sendJSON({"action": "diff", "data": data})

                version = int(notify.payload)
                old_version = version - 1 # TODO do this a better way?

                store.diff(old_version, version, "diff").addCallbacks(diff_cb, err_cb)

            self.token.subscribe(observer)

        self.token.get_store().addCallbacks(store_cb, err_cb)

    def stopListen(self):
        """ Stop listening for database changes. """
        logging.debug("WebSocketsHandler stopListen().")

    def frameReceived(self, frame):
        logging.debug("WebSocketsHandler frameReceived from peer: {0}, frame: {1}".format(self.transport.getPeer(), frame))

        try:
            data = json.loads(frame)
            if data['action'] == "auth":
                try:
                    token = self.tokens.get(data['token'])
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
            elif data['action'] == "diff":
                # turn on/off diff listening
                if data['operation'] == "start":
                    self.startListen()
                    return
                elif data['operation'] == "stop":
                    self.stopListen()
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

    def connectionMade(self):
        logging.debug("WebSocket connectionMade from {0}: ".format(self.transport.getPeer()))

        # TokenKeeper from the webserver. The "webserver" attribtue in site is added in server.py when we create the WebSocketsSite.
        self.tokens = self.transport._request.site.webserver.tokens
        self.token = None

    def connectionLost(self, reason):
        logging.debug("WebSocket connectionLost, reason: {0}.".format(reason))

