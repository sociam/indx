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

class IndxResponse:

    def __init__(self, code, message, data = {}, headers = {}):
        self.code = code
        self.message = message
        if data is None: # handle legacy code
            data = {}
        self.data = data
        self.headers = {}

    def setHeader(self, key, value):
        self.headers[key] = value

    def to_json(self):
        """ To JSON e.g. for sending over a WebSocket. """
        return {
            "code": self.code,
            "message": self.message,
            "data": self.data,
            "headers": self.headers,
        }


