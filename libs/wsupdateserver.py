#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

from twisted.internet import reactor
from autobahn.websocket import WebSocketServerFactory, WebSocketServerProtocol, listenWS

subscribers = []

class UpdateServerProtocol(WebSocketServerProtocol):

    def __init__(self, *args, **kwargs):
        global subscribers
        subscribers.append(self)

    def onMessage(self, msg, binary):
        """ Binary is true/false, msg is the string of the message. """
        print "msg: [%s] binary: [%s]" % (msg, binary)
#        self.sendMessage(msg, binary)
        for sub in subscribers:
            sub.sendMessage(msg, binary)

class WSUpdateServer:

    def __init__(self, port=8214, host="localhost"):
        self.factory = WebSocketServerFactory("ws://%s:%s" % (host, str(port)))
        self.factory.protocol = UpdateServerProtocol
        listenWS(self.factory)
 
#    def run(self):
#        reactor.run()


