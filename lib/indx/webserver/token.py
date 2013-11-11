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

import logging, uuid
import indx.indx_pg2 as database
import indx.objectstore_async
from indx.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure


class Token:
    """ Represents a token, which stores the credentials of the user,
        as well as a reference to the HTTP origin, box and app IDs.
        An objectstore_async is also kept in the token.
    """

    def __init__(self, db, username, password, boxid, appid, origin, clientip):
        self.db = db
        self.username = username
        self.password = password
        self.boxid = boxid
        self.appid = appid
        self.origin = origin
        self.id = str(uuid.uuid1())
        self.clientip = clientip
        self.connections = []
        self.best_acct = None

    def close_all(self):
        """ Close all database connections. """
        for connection in self.connections:
            logging.debug("Closing a database connection: {0}".format(connection))
            connection.close()

    def get_store(self):
        """ Get a new ObjectStoreAsync using the connection pool. """
        result_d = Deferred()

        logging.debug("Token: Getting pooled store for box: {0}, token: {1}".format(self.boxid, self.id))

        def got_acct(new_acct):

            if self.best_acct is None:
                self.best_acct = new_acct

            db_user, db_pass = new_acct

            def connected_cb(conn):
                logging.debug("Token get_store connected, returning it.")
                self.connections.append(conn)

                def get_sync():
                    return database.connect_box_sync(self.boxid, db_user, db_pass)

                def get_raw():
                    return database.connect_box_raw(self.boxid, db_user, db_pass)

                conns = {"conn": conn, "sync_conn": get_sync, "raw_conn": get_raw}
                store = ObjectStoreAsync(conns, self.username, self.boxid, self.appid, self.clientip)
                result_d.callback(store)

            database.connect_box(self.boxid, db_user, db_pass).addCallbacks(connected_cb, result_d.errback)

        if self.best_acct is None:
            self.db.lookup_best_acct(self.boxid, self.username, self.password).addCallbacks(got_acct, result_d.errback)
        else:
            got_acct(self.best_acct)

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

    def __init__(self, db):
        self.tokens = {}
        self.db = db

    def close_all(self):
        """ Close all database connections. """
        logging.debug("Closing all database connections...")
        for box, token in self.tokens.items():
            logging.debug("Closing database connections in box {0}".format(box))
            

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
        logging.debug("Token Keeper - new token for: {0} to {1}".format(username, boxid))
        token = Token(self.db,username,password,boxid,appid,origin,clientip)
        self.add(token)
        return token


