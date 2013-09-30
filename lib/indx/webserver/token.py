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
from indx.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred

SHARERS = {} # one connection per box to listen to updates

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

                conns = {"conn": conn, "sync_conn": get_sync}
                store = ObjectStoreAsync(conns, self.username, self.appid, self.clientip)
                result_d.callback(store)

            database.connect_box(self.boxid, db_user, db_pass).addCallbacks(connected_cb, result_d.errback)

        if self.best_acct is None:
            self.db.lookup_best_acct(self.boxid, self.username, self.password).addCallbacks(got_acct, result_d.errback)
        else:
            got_acct(self.best_acct)

        return result_d


    def subscribe(self, observer):
        """ Add an observer to a box. """
        logging.debug("Token: Adding subscriber to box {0}".format(self.boxid))

        if self.boxid in SHARERS:
            SHARERS[self.boxid].subscribe(observer)
        else:

            """ We create self.boxid in SHARERS immediately to try to avoid a race condition in the 'if' above.
                This means we have to add the store via a function call, rather than through the constructor.
                This is because the store is created through a callback, so there is a delay.
                It works out OK because subscribers will always be added to the list at the point of
                subscription, but they only receive notifications when the notification connection has been established.
            """
            SHARERS[self.boxid] = ConnectionSharer(self.boxid)
            SHARERS[self.boxid].subscribe(observer)

            def err_cb(failure):
                logging.error("Token: subscribe, error on getting raw store: {0}".format(failure))
                failure.trap(Exception)
                raise failure.value # TODO check that exceptions are OK - I assume so becaus this function doesn't return a Deferred

            def raw_store_cb(store):
                SHARERS[self.boxid].add_store(store)

            self._get_raw_store().addCallbacks(raw_store_cb, err_cb)

    def _get_raw_store(self):
        """ Get an ObjectStoreAsync that doesn't use the connection pool - used for listening for notifications. """
        result_d = Deferred()
        logging.debug("Token: Getting raw store for box: {0}, token: {1}".format(self.boxid, self.id))


        def got_acct(new_acct):
            if new_acct == False:
                e = Exception("Permission Denied")
                failure = Failure(e)
                result_d.errback(failure)
                return

            if self.best_acct is None:
                self.best_acct = new_acct

            db_user, db_pass = new_acct

            def connected_cb(conn):
                logging.debug("Token get_raw_store connected, returning it.")
                self.connections.append(conn)

                def get_sync():
                    return database.connect_box_sync(self.boxid, db_user, db_pass)

                conns = {"conn": conn, "sync_conn": get_sync}
                raw_store = ObjectStoreAsync(conns, self.username, self.appid, self.clientip)
                result_d.callback(raw_store)

            def err_cb(failure):
                logging.error("Token get_raw_store error on connection: {0}".format(failure))
                result_d.errback(failure)

            database.connect_box_raw(self.boxid, db_user, db_pass).addCallbacks(connected_cb, err_cb)

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


class ConnectionSharer:
    """ Shares a single non-pooled connection to a box that hangs on a LISTEN call.
    
        The first authenticated user opens the connection and registers as a subscriber.
        
        Later authenticated users only subscribe to it. Each user receives the same update (that a change was made), they then each call a diff (or whatever they want to do) using their own authenticated and pooled connections - this is designed so that we have a single LISTEN call per database, but do not rely on that connection's permissions at all, that is handled by the individual user's connection pool privileges.
    """

    def __init__(self, box):
        """
            box -- The name of the box.
        """

        self.box = box
        self.subscribers = []

    def add_store(self, store):
        """ A store has been connected, so we can start listening.
            store -- A store using a non-pooled connection to the box (that supports adding an observer)
        """
        self.store = store
        self.listen()

    def subscribe(self, observer):
        """ Subscribe to this box's updates.

        observer - A function to call when an update occurs. Parameter sent is re-dispatched from the database.
        """
        self.subscribers.append(observer)

    def listen(self):
        """ Start listening to INDX updates. """

        def observer(notify):
            """ Receive a notification update from the store, and dispatch to subscribers. """
            logging.debug("Received a notification in the ConnectionSharer for box {0}, dispatching to {1} subscribers.".format(self.box, len(self.subscribers)))

            for observer in self.subscribers:
                observer(notify)

        self.store.listen(observer)

