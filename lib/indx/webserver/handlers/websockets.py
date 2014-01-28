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
import uuid
from txWebSocket.websocket import WebSocketHandler
from indx.async import IndxAsync

class WebSocketsHandler(WebSocketHandler):
    """ Handler for the WebServer - acts as a shim to indx.async.IndxASync only - all of the real logic is in there. """

    def __init__(self, transport):
        WebSocketHandler.__init__(self, transport)

        def send_f(data):
            transport.write(data)

        self.sessionid = "{0}".format(uuid.uuid1())
        self.async = IndxAsync(send_f, self.transport._request.site.webserver, self.sessionid, self.transport._request.getClientIP())

    def startListen(self):
        """ Start listening for changes to the database and send diffs when they occur. """
        logging.debug("WebSocketsHandler startListen().")        
        self.async.listen_diff()

    def stopListen(self):
        """ Stop listening for database changes. """
        logging.debug("WebSocketsHandler stopListen().")

    def frameReceived(self, frame):
        logging.debug("WebSocketsHandler frameReceived from peer: {0}, frame: {1}".format(self.transport.getPeer(), frame))
        self.async.receive(frame)

    def connectionMade(self):
        logging.debug("WebSocket connectionMade from {0}: ".format(self.transport.getPeer()))
        self.async.connected()

    def connectionLost(self, reason):
        logging.debug("WebSocket connectionLost, reason: {0}.".format(reason))


