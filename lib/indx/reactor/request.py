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

class IndxRequest:

    def __init__(self, method, path, params, content, sessionid, callback, clientip):
        self.method = method
        self.path = path
        self.params = params
        self.content = content
        self.clientip = clientip
        self.headers = self.params.get('headers') or {}
        self.args = self.params.get('args') or {}
        self.sessionid = sessionid
        self.callback_f = callback # response callback - pass in an IndxResponse to send it back to the user (HTTP or WebSocket usually)
        self.response = {"headers": {}} #

    def callback(self, response):
        for key, value in self.response['headers'].items():
            response.setHeader(key, value)

        self.callback_f(response)

    ###
    #   compatibility with Twisted request object
    ###
    def getHeader(self, key):
        """ Get a header from this request, or None is not present. """
        return self.headers.get(key)

    def getClientIP(self):
        return self.clientip

    # Add a new _Response_ header
    def setHeader(self, key, value):
        self.response['headers'][key] = value

