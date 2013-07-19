#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
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
from twisted.internet import reactor
from autobahn.websocket import WebSocketClientFactory, WebSocketClientProtocol, connectWS
import logging

thismsg = ""
thisbinary = ""
 
class EchoClientProtocol(WebSocketClientProtocol):
 
    def onOpen(self):
        global thismsg
        global thisbinary
        logging.debug("Sending WS message now...")
        self.sendMessage(thismsg, thisbinary)
        self.dropConnection()
 
class WebSocketClient:
    def __init__(self, port=8214, host="localhost"):
        self.port = port
        self.host = host

    def sendMessage(self, msg, binary):
        global thismsg
        global thisbinary
        thismsg = msg
        thisbinary = binary

        logging.debug("Sending WS message...")

        self.factory = WebSocketClientFactory("ws://%s:%s" % (self.host, str(self.port)) )
        self.factory.protocol = EchoClientProtocol
        connectWS(self.factory)


