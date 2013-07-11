#    This file is part of INDX.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
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


