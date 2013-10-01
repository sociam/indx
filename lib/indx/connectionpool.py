#    Copyright (C) 2013 University of Southampton
#    Copyright (C) 2013 Daniel Alexander Smith
#    Copyright (C) 2013 Max Van Kleek
#    Copyright (C) 2013 Nigel R. Shadbolt
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
from txpostgres import txpostgres
from twisted.internet.defer import Deferred

class IndxConnectionPool:
    """ A wrapper for txpostgres connection pools, which auto-reconnects. """

    def __init__(self, _ignored, *connargs, **connkw):
        logging.debug("IndxConnectionPool starting. ")
        self._ignored = _ignored
        self.connargs = connargs
        self.connkw = connkw
        self.pool = self._connectPool()

    def _connectPool(self):
        logging.debug("IndxConnectionPool _connectionPool")
        return txpostgres.ConnectionPool(self._ignored, *self.connargs, **self.connkw)

    # Wrap existing functions
    def start(self, *args, **kwargs):
        logging.debug("IndxConnectionPool start")
        return self.pool.start(*args, **kwargs)

    def close(self, *args, **kwargs):
        logging.debug("IndxConnectionPool close")
        return self.pool.close(*args, **kwargs)

    def remove(self, *args, **kwargs):
        logging.debug("IndxConnectionPool remove")
        return self.pool.remove(*args, **kwargs)

    def add(self, *args, **kwargs):
        logging.debug("IndxConnectionPool add")
        return self.pool.add(*args, **kwargs)


    # Wrap query functions with auto-reconnection
    def runQuery(self, *args, **kwargs):

        try:
            logging.debug("IndxConnectionPool runQuery")
            deferred = Deferred()
            pool_deferred = self.pool.runQuery(*args, **kwargs)
            pool_deferred.addCallback(deferred.callback)

            def err_cb(failure):
                logging.debug("IndxConnectionPool runQuery err_cb")
                # failure!
                # reconnect and try the query again
                # TODO check exception is a psycopg2.InterfaceError and a "connection already closed" error first, otherwise send on to the deferred errback instead
                def connected2(conn):
                    logging.debug("IndxConnectionPool runQuery err_cb connected2")
                    conn.runQuery(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

                self.pool = self._connectPool()
                self.pool.start().addCallbacks(connected2, deferred.errback) # FIXME is this the best errback?

            pool_deferred.addErrback(err_cb)
            return deferred
        except Exception as e:
            logging.error("IndxConnectionPool runQuery Exception: reconnecting, e: {0}".format(e))

            self.pool = self._connectPool()

            deferred = Deferred()
            def connected(conn):
                logging.debug("IndxConnectionPool runQuery Exception: connected")
                conn.runQuery(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

            # auto-restart the pool
            self.pool.start().addCallbacks(connected, deferred.errback)
            return deferred


    def runOperation(self, *args, **kwargs):
        try:
            logging.debug("IndxConnectionPool runOperation")
            deferred = Deferred()
            pool_deferred = self.pool.runOperation(*args, **kwargs)
            pool_deferred.addCallback(deferred.callback)

            def err_cb(failure):
                logging.debug("IndxConnectionPool runOperation err_cb")
                # failure!
                # reconnect and try the query again
                # TODO check exception is a psycopg2.InterfaceError and a "connection already closed" error first, otherwise send on to the deferred errback instead
                def connected2(conn):
                    logging.debug("IndxConnectionPool runOperation err_cb connected2")
                    conn.runOperation(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

                self.pool = self._connectPool()
                self.pool.start().addCallbacks(connected2, deferred.errback) # FIXME is this the best errback?

            pool_deferred.addErrback(err_cb)
            return deferred
        except Exception as e:
            logging.error("IndxConnectionPool runOperation Exception: reconnecting, e: {0}".format(e))

            self.pool = self._connectPool()

            deferred = Deferred()
            def connected(conn):
                logging.debug("IndxConnectionPool runOperation Exception connected")
                conn.runOperation(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

            # auto-restart the pool
            self.pool.start().addCallbacks(connected, deferred.errback)
            return deferred


    def runInteraction(self, *args, **kwargs):
        logging.debug("IndxConnectionPool runInteraction")
        try:
            deferred = Deferred()
            pool_deferred = self.pool.runInteraction(*args, **kwargs)
            pool_deferred.addCallback(deferred.callback)

            def err_cb(failure):
                logging.debug("IndxConnectionPool runInteraction err_cb")
                # failure!
                # reconnect and try the query again
                # TODO check exception is a psycopg2.InterfaceError and a "connection already closed" error first, otherwise send on to the deferred errback instead
                def connected2(conn):
                    logging.debug("IndxConnectionPool runInteraction err_cb connected2")
                    conn.runInteraction(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

                self.pool = self._connectPool()
                self.pool.start().addCallbacks(connected2, deferred.errback) # FIXME is this the best errback?

            pool_deferred.addErrback(err_cb)
            return deferred
        except Exception as e:
            logging.error("IndxConnectionPool runInteraction Exception: reconnecting, e: {0}".format(e))

            self.pool = self._connectPool()

            deferred = Deferred()
            def connected(conn):
                logging.error("IndxConnectionPool runInteraction Exception connected")
                conn.runInteraction(*args, **kwargs).addCallbacks(deferred.callback, deferred.errback)

            # auto-restart the pool
            self.pool.start().addCallbacks(connected, deferred.errback)
            return deferred


