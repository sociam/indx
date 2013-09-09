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

import os
import logging
import psycopg2
import binascii
from txpostgres import txpostgres
from hashing_passwords import make_hash, check_hash
from indx.crypto import encrypt, decrypt
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure

POOLS = {} # dict of txpostgres.ConnectionPools, one pool for each box/user combo
INDX_PREFIX = "ix_" # prefix to the database names

POSTGRES_DB = "postgres" # default db fallback if db name is none

# changed by server.py if necessary
HOST = "localhost"
PORT = "5432"

class IndxDatabase:
    """ Handle database operations performed by the INDX user. """

    def __init__(self, db_name, db_user, db_pass):
        """ Define the INDX database name, and authentication details. """
        self.db_name = db_name
        self.db_user = db_user
        self.db_pass = db_pass


    def auth_indx(self, database = None):
        """ Authenticate the INDX database credentials. """
        return_d = Deferred()

        if database is None:
            database = self.db_name

        # get a connection to the INDX db from the pool
        connect(database, self.db_user, self.db_pass).addCallbacks(return_d.callback, return_d.errback)
        return return_d


    def auth(self, username, password):
        """ Authenticate as a user. """
        return_d = Deferred()

        def connected_cb(conn):
            """ Get the password hash of a user and check it against the supplied password. """
            d = conn.runQuery("SELECT username_type, password_hash FROM tbl_users WHERE username = %s", [username])

            def hash_cb(rows):
                if len(rows) == 0:
                    return_d.callback(False) # return False if user not in DB
                    return

                username_type, password_hash = rows[0]
                return_d.callback(check_hash(password, password_hash)) # check hash and return result
                return

            d.addCallbacks(hash_cb, return_d.errback)

        # get a connection to the INDX db from the pool
        connect(self.db_name, self.db_user, self.db_pass).addCallbacks(connected_cb, return_d.errback)
        return return_d


    def check_indx_db(self):
        """ Check the INDX db exists, and create if it doesn't. """
        return_d = Deferred()

        def connected_cb(conn):
            d = conn.runQuery("SELECT 1 from pg_database WHERE datname='{0}'".format(self.db_name))

            def check_cb(rows):
                if len(rows) == 0:
                    d2 = conn.runOperation("CREATE DATABASE %s WITH ENCODING='UTF8' OWNER=%s CONNECTION LIMIT=-1" % (self.db_name, self.db_user))

                    def create_cb(empty):
                        # load in definition from data/objectstore-*.sql

                        def connect_indx(conn_indx):
                            queries = ""
                            source_files = ['indx-schema.sql']
                            for src_file in source_files:
                                fh_objsql = open(os.path.join(os.path.dirname(__file__),"..","data",src_file)) # FIXME put into config
                                objsql = fh_objsql.read()
                                fh_objsql.close()
                                queries += objsql + " "

                            conn_indx.runOperation(queries).addCallbacks(lambda success: return_d.callback(True), return_d.errback)

                        connect(self.db_name, self.db_user, self.db_pass).addCallbacks(connect_indx, return_d.errback)


                    d2.addCallbacks(create_cb, return_d.errback)
                else:
                    return_d.callback(True)

            d.addCallbacks(check_cb, return_d.errback)

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected_cb, return_d.errback)
        return return_d


    def create_database_users(self, db_name):
        """ Create new database users for a specific database, one with read-write access, and one with read access.
        """
        return_d = Deferred()

        rw_user = "{0}{1}_rw".format(INDX_PREFIX, db_name)
        rw_user_pass = binascii.b2a_hex(os.urandom(16))
        ro_user = "{0}{1}_ro".format(INDX_PREFIX, db_name)
        ro_user_pass = binascii.b2a_hex(os.urandom(16))

        queries = [
            "CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE" % (rw_user, rw_user_pass),
            "CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE" % (ro_user, ro_user_pass),        
            "ALTER DATABASE %s OWNER TO %s" % (db_name, rw_user),
            "GRANT ALL PRIVILEGES ON DATABASE %s TO %s" % (db_name, rw_user),
            "GRANT SELECT ON DATABASE %s TO %s" % (db_name, ro_user),
        ]

        def created(conn):
            return_d.callback((rw_user, rw_user_pass, ro_user, ro_user_pass))
            return

        def connected(conn):
            if len(queries) < 1:
                created(conn)

            query = queries.pop(0)
            d = conn.runQuery(query)
            d.addCallbacks(lambda rows: connected(conn), lambda failure: return_d.errback(failure))
            return

        # get connection to INDX database from POOL
        connect(self.db_name, self.db_user, self.db_pass).addCallbacks(connected, lambda failure: return_d.errback(failure))
        return return_d


    def create_user(self, new_username, new_password):
        """ Create a new INDX user. """
        return_d = Deferred()

        pw_hash = make_hash(new_password)
        pw_encrypted = encrypt(new_password, self.db_pass)

        def connected(conn):
            d = conn.runOperation("INSERT INTO tbl_users (username, username_type, password_hash, password_encrypted) VALUES (%s, %s, %s, %s)",[new_username, 'local_owner', pw_hash, pw_encrypted])
            d.addCallbacks(lambda *x: return_d.callback(None), return_d.errback)
            return

        connect(self.db_name, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d


    def create_box(self, box_name, db_owner, db_owner_pass):
        """ Create a new database. """
        return_d = Deferred()
        db_name = INDX_PREFIX + box_name 

        def connected(conn):

            def created(val):

                def connected_newdb(conn_newdb):
                    queries = ""
                    # ordered list of source database creation files
                    source_files = ['objectstore-schema.sql', 'objectstore-views.sql', 'objectstore-functions.sql', 'objectstore-indexes.sql']
                    for src_file in source_files:
                        fh_objsql = open(os.path.join(os.path.dirname(__file__),"..","data",src_file)) # FIXME put into config
                        objsql = fh_objsql.read()
                        fh_objsql.close()
                        queries += " " + objsql # concat operations together and run once below

                    def operations_cb(empty):

                        def created_cb(user_details):
                            rw_user, rw_user_pass, ro_user, ro_user_pass = user_details

                            # assign ownership now to db_owner
                            rw_pw_encrypted = encrypt(rw_user_pass, db_owner_pass)
                            ro_pw_encrypted = encrypt(ro_user_pass, db_owner_pass)

                            def indx_db(conn_indx):
                                d_q = conn_indx.runOperation("INSERT INTO tbl_keychain (user_id, db_name, db_user, db_user_type, db_password_encrypted) VALUES ((SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s), ((SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s)", [db_owner, db_name, rw_user, 'rw', rw_pw_encrypted, db_owner, db_name, ro_user, 'ro', ro_pw_encrypted])

                                def inserted(empty):
                                    logging.debug("create_box finished")
                                    return_d.callback(True)

                                d_q.addCallbacks(inserted, return_d.errback)

                            # connect to INDX db to add new DB accounts to keychain
                            connect(self.db_name, self.db_user, self.db_pass).addCallbacks(indx_db, return_d.errback)
                            
                        d = self.create_database_users(db_name)
                        d.addCallbacks(created_cb, return_d.errback)

                    conn_newdb.runOperation(queries).addCallbacks(operations_cb, return_d.errback)

                connect(db_name, self.db_user, self.db_pass).addCallbacks(connected_newdb, return_d.errback)  ### XXX finish
            
            d = conn.runQuery("CREATE DATABASE %s WITH ENCODING='UTF8' OWNER=%s CONNECTION LIMIT=-1" % (db_name, self.db_user))
            d.addCallbacks(created, return_d.errback)

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d


    def list_databases(self):
        return_d = Deferred()

        def db_list(rows):
            dbs = []
            for row in rows:
                db = row[0] # strip wb_ prefix from name
                dbs.append(db)
            return_d.callback(dbs)

        def connected(conn):
            conn.runQuery("SELECT datname FROM pg_database WHERE datname LIKE %s", [INDX_PREFIX+"%"]).addCallbacks(db_list, return_d.errback)

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d


    def list_boxes(self):
        return_d = Deferred()
        def db_list(dbs):
            boxes = []
            for db in dbs:
                box = db[len(INDX_PREFIX):]
                boxes.append(box)
            return_d.callback(boxes)

        d = self.list_databases()
        d.addCallbacks(db_list, return_d.errback)

        return return_d


    def delete_box(self, box_name):
        # delete the database
        logging.debug("Delete box {0} req from user {1}".format(box_name, db_user))
        return_d = Deferred()

        def connected(conn):
            db_name = INDX_PREFIX + box_name 
            d = conn.runOperation("DROP DATABASE {0}".format(db_name))
            d.addCallbacks(lambda done: return_d.callback(True), return_d.errback)

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d

    def list_users(self):
        """ Create a new user, and connect as the specified user.
        """
        return_d = Deferred()

        def done(conn, rows):
            logging.debug("indx_pg2.list_users.done : {0}".format(repr(rows)))        
            users = []
            for r in rows:  users.append(r[0])
            # conn.close() # close the connection        
            return_d.callback(users)
            return

        def fail(err):
            logging.debug('indx_pg2.list_users failure >>>>>>> ');
            logging.error(err)
            return_d.errback(err)

        def connected(conn):
            logging.debug("indx_pg2.list_users : connected")
            d = conn.runQuery("SELECT DISTINCT username FROM tbl_users")
            d.addCallbacks(lambda rows: done(conn, rows), lambda failure: fail(failure))
            return

        logging.debug('indx_pg2.list_users - connecting: {0}'.format(self.db_user));

        connect(self.db_name, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d
    


# Connection Functions

def connect(db_name, db_user, db_pass):
    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))

    result_d = Deferred()
    if conn_str in POOLS:
        logging.debug("indx_pg2: returning existing pool for db: {0}, user: {1}".format(db_name, db_user))
        pool = POOLS[conn_str]
        # already connected, so just return a defered with itself
        result_d.callback(pool)
    else:
        # not connected yet, so return after start() finished

        def success(pool):
            logging.debug("indx_pg2: returning new pool for db: {0}, user: {1}, pool: {2}".format(db_name, db_user, pool))
            POOLS[conn_str] = pool # only do this if it successfully connects
            result_d.callback(pool)

        p = txpostgres.ConnectionPool(None, conn_str)
        p.start().addCallbacks(success, lambda failure: result_d.errback(failure))

    return result_d


def connect_sync(self, db_name, db_user, db_pass):
    """ Connect synchronously to the database - only used for large object support. """
    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))
    conn = psycopg2.connect(conn_str)
    return conn


def connect_raw(db_name, db_user, db_pass):
    """ Connect to the database bypassing the connection pool (e.g., for adding a notify observer). """

    try:
        conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))
        conn = txpostgres.Connection()
        connection = conn.connect(conn_str)
        return connection
    except Exception as e:
        logging.error("DB: Error connecting to {0} as {1} ({2})".format(db_name, db_user, e))
        d = Deferred()
        failure = Failure(e)
        d.errback(failure)
        return d


def connect_box_sync(box_name, db_user, db_pass):
    return connect_sync(INDX_PREFIX + box_name, db_user, db_pass)

def connect_box_raw(box_name, db_user, db_pass):
    return connect_raw(INDX_PREFIX + box_name, db_user, db_pass)

def connect_box(box_name,db_user,db_pass):
    return connect(INDX_PREFIX + box_name, db_user, db_pass)


