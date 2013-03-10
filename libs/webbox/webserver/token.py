#    This file is part of WebBox.
#
#    Copyright 2012-2013 Daniel Alexander Smith, eMax
#    Copyright 2012-2013 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging, uuid

class Token:
    """ Represents a token, which stores the credentials of the user,
        as well as a reference to the HTTP origin, box and app IDs.
        An objectstore_async is also kept in the token.
    """

    def __init__(self, username, password, boxid, appid, origin, store):
        self.username = username
        self.password = password
        self.boxid = boxid
        self.appid = appid
        self.origin = origin
        self.store = store
        self.id = str(uuid.uuid1())

    def verify(self,boxname,appname,origin):
        logging.debug("Verify token ({0}) with boxid: {1} and origin {2}, to request boxid: {3} and request origin: {4}".format(self.id, self.boxid, self.origin, boxname, origin))
        # origin is None means we're same origin
        return self.boxid == boxname and origin is None or self.origin == origin and appname # APPNAME CHECK TODO
        
class TokenKeeper:
    """ Keeps a set of tokens for the web server.
    """
    # handles token garbage collection at some time in the future!

    def __init__(self):
        self.tokens = {}

    def get(self, tid):
        """ Used to get a token by the BaseHandler, and whenever a
            handler needs to token (usually because it wants to access
            the store object).

            tid -- The ID of the Token to get, it must have already been
                created, usually by the get_token call to the AuthHandler.
        """
        return self.tokens.get(tid)

    def add(self,token):
        self.tokens[token.id] = token
        return token

    def new(self,username,password,boxid,appid,origin,store):
        token = Token(username,password,boxid,appid,origin,store)
        self.add(token)
        return token
 
