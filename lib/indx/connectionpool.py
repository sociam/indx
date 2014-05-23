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
import copy
import indx_pg2
import time
import psycopg2
from txpostgres import txpostgres
from twisted.internet.defer import Deferred, DeferredSemaphore, DeferredList
from twisted.internet import threads
from twisted.python.failure import Failure
from twisted.internet import reactor

MIN_CONNS = 1
MAX_CONNS = 5
REMOVE_AT_ONCE = 3

class IndxConnectionPool:
    """ A wrapper for txpostgres connection pools, which auto-reconnects. """

    def __init__(self):
        logging.debug("IndxConnectionPool starting. ")
        self.connections = {} # by connection string
        self.conn_strs = {} # by db_name
        self.semaphore = DeferredSemaphore(1)
        self.subscribers = {} # by db name

    def removeAll(self, db_name):
        logging.debug("IndxConnectionPool removeAll {0}".format(db_name))
        d_list = []
        for conn_str in self.conn_strs[db_name]:
            for conn in self.connections[conn_str].getInuse():
                d_list.append(conn.close())
            for conn in self.connections[conn_str].getFree():
                d_list.append(conn.close())

        del self.connections[conn_str]
        del self.conn_strs[db_name]

        dl = DeferredList(d_list)
        return dl

    def connect(self, db_name, db_user, db_pass, db_host, db_port):
        """ Returns an IndxConnection (Actual connection and pool made when query is made). """

        return_d = Deferred()
        log_conn_str = "dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}' application_name='{5}'".format(db_name, db_user, "XXXX", db_host, db_port, indx_pg2.APPLICATION_NAME)
        conn_str = "dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}' application_name='{5}'".format(db_name, db_user, db_pass, db_host, db_port, indx_pg2.APPLICATION_NAME)
        logging.debug("IndxConnectionPool connect: {0}".format(log_conn_str))

        if db_name not in self.conn_strs:
            self.conn_strs[db_name] = []
        self.conn_strs[db_name].append(conn_str)

        def free_cb(conn):
            logging.debug("IndxConnectionPool free_cb, conn: {0}".format(conn))

            def locked_cb(empty):
                logging.debug("IndxConnectionPool locked_cb")
                self.connections[conn_str].getInuse().remove(conn)
                
                if len(self.connections[conn_str].getWaiting()) > 0:
                    callback = self.connections[conn_str].getWaiting().pop()
                    self.connections[conn_str].getInuse().append(conn)
                    self.semaphore.release()
                    callback(conn)
                    return
                
                self.connections[conn_str].getFree().append(conn)
                self.semaphore.release()


            def err_cb(failure):
                logging.error("IndxConnectionPool error in free_cb: {0}".format(failure))
                self.semaphore.release()

            self.semaphore.acquire().addCallbacks(locked_cb, err_cb)


        def alloc_cb(conn_str):
            # a query was called - allocate a connection now and pass it back
            return self._connect(conn_str)
 
        indx_connection = IndxConnection(conn_str, alloc_cb, free_cb)
        return_d.callback(indx_connection)
        return return_d


    def _connect(self, conn_str):
        """ Connect and return a free Connection.
            Figures out whether to make new connections, use the pool, or wait in a queue.
        """
        logging.debug("IndxConnectionPool _connect ({0})".format(conn_str))
        return_d = Deferred()

        def err_cb(failure):
            logging.error("IndxConnectionPool _connect err_cb: {0}".format(failure))
            self.semaphore.release()
            return_d.errback(failure)

        def succeed_cb(empty):
            logging.debug("IndxConnectionPool _connect succeed_cb")
            # TODO pass a Connection back
            
            if len(self.connections[conn_str].getFree()) > 0:
                # free connection, use it straight away
                conn = self.connections[conn_str].getFree().pop()

                self.connections[conn_str].getInuse().append(conn)
                self.semaphore.release()
                return_d.callback(conn)
                return

            if len(self.connections[conn_str].getInuse()) < MAX_CONNS:
                # not at max connections for this conn_str
                
                # create a new one
                d = self._newConnection(conn_str)

                def connected_cb(indx_conn):
                    logging.debug("IndxConnectionPool _connect connected_cb ({0})".format(indx_conn))
                    self.connections[conn_str].getFree().remove(indx_conn)
                    self.connections[conn_str].getInuse().append(indx_conn)
                    self.semaphore.release()
                    return_d.callback(indx_conn)
                    return

                d.addCallbacks(connected_cb, err_cb)
                return

            # wait for a connection
            def wait_cb(conn):
                logging.debug("IndxConnectionPool _connect wait_cb ({0})".format(conn))
                # already put in 'inuse'
                return_d.callback(conn)
                return

            self.semaphore.release()
            self.connections[conn_str].getWaiting().append(wait_cb)
            return

        def locked_cb(empty):
            logging.debug("IndxConnectionPool _connect locked_cb")
            if conn_str not in self.connections:
                self._newConnections(conn_str).addCallbacks(succeed_cb, err_cb)
            else:
                threads.deferToThread(succeed_cb, None)
#                succeed_cb(None)

        self.semaphore.acquire().addCallbacks(locked_cb, err_cb)
        return return_d

    def _closeOldConnection(self):
        """ Close the oldest connection, so we can open a new one up. """
        # is already in a semaphore lock, from _newConnection
        logging.debug("IndxConnectionPool _closeOldConnection")

        ### we could force quite them through postgresql like this - but instead we kill them from inside
        #query = "SELECT * FROM pg_stat_activity WHERE state = 'idle' AND application_name = %s AND query != 'LISTEN wb_new_version' ORDER BY state_change LIMIT 1;"
        #params = [indx_pg2.APPLICATION_NAME]

        return_d = Deferred()

        def err_cb(failure):
            return_d.errback(failure)

        ages = {}
        for conn_str, dbpool in self.connections.items():
            lastused = dbpool.getTime()
            ages[lastused] = dbpool

        times = ages.keys()
        times.sort()

        def removed_cb(count):

            if count < REMOVE_AT_ONCE and len(times) > 0:
                first_time = times.pop(0)
                pool = ages[first_time]
                pool.removeAll(count).addCallbacks(removed_cb, err_cb)
                pool.getFree()
            else:
                return_d.callback(None)
        
        removed_cb(0)
        return return_d

    def _newConnection(self, conn_str):
        """ Makes a new connection to the DB
            and then puts it in the 'free' pool of this conn_str.
        """
        logging.debug("IndxConnectionPool _newConnection")
        # lock with the semaphore before calling this
        return_d = Deferred()

        def close_old_cb(failure):
            failure.trap(psycopg2.OperationalError, Exception)
            # couldn't connect, so close an old connection first
            logging.error("IndxConnectionPool error close_old_cb: {0}".format(failure.value))

            def closed_cb(empty):
                # closed, so try connecting again
                self._newConnection(conn_str).addCallbacks(return_d.callback, return_d.errback)

            closed_d = self._closeOldConnection()
            closed_d.addCallbacks(closed_cb, return_d.errback)

        try:
            # try to connect
            def connected_cb(connection):
                logging.debug("IndxConnectionPool _newConnection connected_cb, connection: {0}".format(connection))
                self.connections[conn_str].getFree().append(connection)
                return_d.callback(connection)

            conn = txpostgres.Connection()
            connection_d = conn.connect(conn_str)
            connection_d.addCallbacks(connected_cb, close_old_cb)
        except Exception as e:
            # close an old connection first
            logging.debug("IndxConnectionPool Exception, going to call close_old_cb: ({0})".format(e))
            close_old_cb(Failure(e))

        return return_d

    def _newConnections(self, conn_str):
        """ Make a pool of new connections. """
        # lock with the semaphore before calling this
        logging.debug("IndxConnectionPool _newConnections")
        return_d = Deferred()

        self.connections[conn_str] = DBConnectionPool(conn_str)

        try:
            d_list = []
            for i in range(MIN_CONNS):
                connection_d = self._newConnection(conn_str) 
                d_list.append(connection_d)

            dl = DeferredList(d_list)
            dl.addCallbacks(return_d.callback, return_d.errback)

        except Exception as e:
            logging.error("IndxConnectionPool error in _newConnections: {0}".format(e))
            return_d.errback(Failure(e))

        return return_d

class DBConnectionPool():
    """ A pool of DB connections for a specific connection string / DB. """

    def __init__(self, conn_str):
        self.waiting = []
        self.inuse = []
        self.free = []

        self.semaphore = DeferredSemaphore(1)

        self.updateTime()

    def updateTime(self):
        self.lastused = time.mktime(time.gmtime()) # epoch time

    def getTime(self):
        return self.lastused

    def getWaiting(self):
        self.updateTime()
        return self.waiting

    def getInuse(self):
        self.updateTime()
        return self.inuse

    def getFree(self):
        self.updateTime()
        return self.free

    def removeAll(self, count):
        """ Remove a connection (usually because it's old and we're in
            a freeing up perid.
        """
        return_d = Deferred()
        self.updateTime()

        def err_cb(failure):
            self.semaphore.release()
            return_d.errback(failure)

        def locked_cb(count):
            # immediately close the free connections
            while len(self.free) > 0:
                conn = self.free.pop()
                conn.close()
                count += 1

            self.semaphore.release()
            return_d.callback(count)

        self.semaphore.acquire().addCallbacks(lambda s: locked_cb(count), err_cb)
        return return_d


class IndxConnection():
    """ Wrap a connection around a callback so we can track when it's in-use/free. """

    def __init__(self, conn_str, alloc_cb, free_cb):
        self.conn_str = conn_str
        self.alloc_cb = alloc_cb
        self.free_cb = free_cb

    def _putBackAndPassthrough(self, result, connection):
        self.free_cb(connection)
        return result

    def runQuery(self, *args, **kwargs):
        """
        Execute an SQL query using a pooled connection and return the result.

        One of the pooled connections will be chosen, its
        :meth:`~txpostgres.txpostgres.Connection.runQuery` method will be
        called and the resulting :d:`Deferred` will be returned.

        :return: A :d:`Deferred` obtained by a pooled connection's
            :meth:`~txpostgres.txpostgres.Connection.runQuery`
        """
        logging.debug("IndxConnection runQuery: {0}".format(args))
        return_d = Deferred()

        def alloced_cb(connection):
            logging.debug("IndxConnection runQuery alloced")
            d = connection.runQuery(*args, **kwargs)
            d.addBoth(self._putBackAndPassthrough, connection)
            d.addCallbacks(return_d.callback, return_d.errback)

        self.alloc_cb(self.conn_str).addCallbacks(alloced_cb, return_d.errback)
        return return_d


    def runOperation(self, *args, **kwargs):
        """
        Execute an SQL query using a pooled connection and discard the result.

        One of the pooled connections will be chosen, its
        :meth:`~txpostgres.txpostgres.Connection.runOperation` method will be
        called and the resulting :d:`Deferred` will be returned.

        :return: A :d:`Deferred` obtained by a pooled connection's
            :meth:`~txpostgres.txpostgres.Connection.runOperation`
        """
        logging.debug("IndxConnection runOperation: {0}".format(args))
        return_d = Deferred()

        def alloced_cb(connection):
            logging.debug("IndxConnection runOperation alloced")
            d = connection.runOperation(*args, **kwargs)
            d.addBoth(self._putBackAndPassthrough, connection)
            d.addCallbacks(return_d.callback, return_d.errback)

        self.alloc_cb(self.conn_str).addCallbacks(alloced_cb, return_d.errback)
        return return_d

    def runInteraction(self, interaction, *args, **kwargs):
        """
        Run commands in a transaction using a pooled connection and return the
        result.

        One of the pooled connections will be chosen, its
        :meth:`~txpostgres.txpostgres.Connection.runInteraction` method will be
        called and the resulting :d:`Deferred` will be returned.

        :param interaction: A callable that will be passed to
            :meth:`Connection.runInteraction
            <txpostgres.Connection.runInteraction>`
        :type interaction: any callable

        :return: A :d:`Deferred` obtained by a pooled connection's
            :meth:`Connection.runInteraction
            <txpostgres.Connection.runInteraction>`
        """
        logging.debug("IndxConnection runInteraction: {0}".format(args))
        return_d = Deferred()

        def alloced_cb(connection):
            logging.debug("IndxConnection runInteraction alloced")
            d = connection.runInteraction(interaction, *args, **kwargs)
            d.addBoth(self._putBackAndPassthrough, connection)
            d.addCallbacks(return_d.callback, return_d.errback)

        self.alloc_cb(self.conn_str).addCallbacks(alloced_cb, return_d.errback)
        return return_d

