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
import webbox.webbox_pg2 as database
from webbox.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred

class Token:
    """ Represents a token, which stores the credentials of the user,
        as well as a reference to the HTTP origin, box and app IDs.
        An objectstore_async is also kept in the token.
    """

    def __init__(self, username, password, boxid, appid, origin, clientip):
        self.username = username
        self.password = password
        self.boxid = boxid
        self.appid = appid
        self.origin = origin
        self.id = str(uuid.uuid1())
        self.clientip = clientip

    def get_store(self):
        """ Get a new ObjectStoreAsync using the connection pool. """
        result_d = Deferred()

        logging.debug("Token: Getting pooled store for box: {0}, token: {1}".format(self.boxid, self.id))

        def connected_cb(conn):
            logging.debug("Token get_store connected, returning it.")

            def get_sync():
                return database.connect_box_sync(self.boxid, self.username, self.password)

            conns = {"conn": conn, "sync_conn": get_sync}
            store = ObjectStoreAsync(conns, self.username, self.appid, self.clientip)
            result_d.callback(store)

        def err_cb(failure):
            logging.error("Token get_store error on connection: {0}".format(failure))
            result_d.errback(failure)

        database.connect_box(self.boxid, self.username, self.password).addCallbacks(connected_cb, err_cb)
        return result_d

    def get_raw_store(self):
        """ Get an ObjectStoreAsync that doesn't use the connection pool - used for listening for notifications. """
        result_d = Deferred()
        logging.debug("Token: Getting raw store for box: {0}, token: {1}".format(self.boxid, self.id))

        def connected_cb(conn):
            logging.debug("Token get_raw_store connected, returning it.")

            def get_sync():
                return database.connect_box_sync(self.boxid, self.username, self.password)

            conns = {"conn": conn, "sync_conn": get_sync}
            raw_store = ObjectStoreAsync(conns, self.username, self.appid, self.clientip)
            result_d.callback(raw_store)

        def err_cb(failure):
            logging.error("Token get_raw_store error on connection: {0}".format(failure))
            result_d.errback(failure)

        database.connect_box_raw(self.boxid, self.username, self.password).addCallbacks(connected_cb, err_cb)
        return result_d
 
    def verify(self,boxname,appname,origin):
        # origin is None means we're same origin
        verified = self.boxid == boxname and origin is None or self.origin == origin and appname # APPNAME CHECK TODO
        logging.debug("Verify token (verified={5}) ({0}) with boxid: {1} and origin {2}, to request boxid: {3} and request origin: {4}".format(self.id, self.boxid, self.origin, boxname, origin, verified))
        return verified


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

    def new(self,username,password,boxid,appid,origin,clientip):
        token = Token(username,password,boxid,appid,origin,clientip)
        self.add(token)
        return token
 
