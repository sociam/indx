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
import indx.indx_pg2 as database
from indx.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure


class Token:
    """ Represents a token, which stores the credentials of the user,
        as well as a reference to the HTTP origin, box and app IDs.
        An objectstore_async is also kept in the token.
    """

    def __init__(self, db, username, password, boxid, appid, origin, clientip, server_id):
        self.db = db
        self.username = username
        self.password = password
        self.boxid = boxid
        self.appid = appid
        self.origin = origin
        self.id = str(uuid.uuid1())
        self.clientip = clientip
        self.connections = []
        self.server_id = server_id
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

            if new_acct is False:
                failure = Failure(Exception("No access to box {0} for user {1}".format(self.boxid, self.username)))
                result_d.errback(failure)
                return

            if self.best_acct is None:
                self.best_acct = new_acct

            db_user, db_pass = new_acct

            #self.connections.append(conn)
            def conn_passthru(conn, deferred):
                """ Pass a connection through to a callback, while keeping a reference of it here. """
                self.connections.append(conn)
                deferred.callback(conn)

            def get_sync():
                return_d = Deferred()
                database.connect_box_sync(self.boxid, db_user, db_pass).addCallbacks(lambda conn: conn_passthru(conn, return_d), return_d.errback)
                return return_d

            def get_raw():
                return_d = Deferred()
                database.connect_box_raw(self.boxid, db_user, db_pass).addCallbacks(lambda conn: conn_passthru(conn, return_d), return_d.errback)
                return return_d

            def get_conn():
                return_d = Deferred()
                database.connect_box(self.boxid, db_user, db_pass).addCallbacks(lambda conn: conn_passthru(conn, return_d), return_d.errback)
                return return_d

            def get_indx_conn():
                return_d = Deferred()
                self.db.connect_indx_db().addCallbacks(lambda conn: conn_passthru(conn, return_d), return_d.errback)
                return return_d

            conns = {"conn": get_conn, "sync_conn": get_sync, "raw_conn": get_raw, "indx_conn": get_indx_conn}
            store = ObjectStoreAsync(conns, self.username, self.boxid, self.appid, self.clientip, self.server_id)

            def upgrade_cb(result):
                result_d.callback(store)

            store.schema_upgrade().addCallbacks(upgrade_cb, result_d.errback)

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
        return_d = Deferred()

        if self.tokens.get(tid) is not None:
            # already in cache, return existing
            return_d.callback(self.tokens.get(tid))
            return return_d

        # otherwise check the db
        def token_cb(token_tuple):
            if token_tuple is None:
                return_d.callback(None)
                return

            username, password, boxid, appid, origin, clientip, server_id = token_tuple
            token = Token(self.db, username, password, boxid, appid, origin, clientip, server_id)

            self.add(token)
            return_d.callback(token)
            return

        self.db.get_token(tid).addCallbacks(token_cb, return_d.errback)
        return return_d

    def add(self,token):
        self.tokens[token.id] = token
        return token

    def new(self,username,password,boxid,appid,origin,clientip, server_id):
        logging.debug("Token Keeper - new token for: {0} to {1}".format(username, boxid))
        return_d = Deferred()

        token = Token(self.db,username,password,boxid,appid,origin,clientip, server_id)
        self.add(token)

        def saved_cb(empty):
            return_d.callback(token)

        self.db.save_token(token).addCallbacks(saved_cb, return_d.errback)
        return return_d


