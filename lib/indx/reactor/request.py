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
from indx.reactor import IndxResponse

class IndxRequest:

    def __init__(self, uri, method, base_path, path, params, content, sessionid, callback, clientip, server_id):
        self.uri = uri
        self.method = method
        self.base_path = base_path
        self.path = path
        self.params = params
        self.content = content
        self.clientip = clientip

        # lowercase all headers so that any gets are case-insensitive
        self.headers = {}
        for k in self.params.get('headers') or []:
            v = self.params.get('headers')[k]
            if type(v) == type([]):
                self.headers[k] = []
                for item in v:
                    self.headers[k] = item.lower()
            else:
                self.headers[k] = v.lower()

        self.args = self.params.get('args') or {}
        self.sessionid = sessionid
        self.callback_f = callback # response callback - pass in an IndxResponse to send it back to the user (HTTP or WebSocket usually)
        self.response = {"headers": {}} #
        self.server_id = server_id

    def callback(self, response):
        for key, value in self.response['headers'].items():
            response.setHeader(key, value)

        if self.response.get("code") is not None:
            response.code =  self.response.get("code")

        if self.response.get("message") is not None:
            response.message =  self.response.get("message")

        self.callback_f(response)

    def getHeaders(self):
        return self.headers

    ###
    #   compatibility with Twisted request object
    ###
    def getHeader(self, key):
        """ Get a header from this request, or None is not present. """
        key = key.lower()
        return self.headers.get(key)

    def getClientIP(self):
        return self.clientip

    # Add a new _Response_ header
    def setHeader(self, key, value):
        self.response['headers'][key] = value

    def setResponseCode(self, code, message):
        """ Set the response code. """
        self.response['code'] = code
        self.response['message'] = message

    def finish(self):
        code = self.response.get("code")
        message = self.response.get("message")

        if code is None:
            code = 500
            message = "Internal Server Error"

        response = IndxResponse(code, message)
        self.callback(response)

    def getServerID(self):
        return self.server_id

