#    This file is part of INDX.
#
#    Copyright 2012-2013 Daniel Alexander Smith, Max Van Kleek
#    Copyright 2012-2013 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import os, logging, psycopg2
from txpostgres import txpostgres
from twisted.internet.defer import Deferred

## webbox to txpostgres bridge

POSTGRES_DB = "postgres" # default db fallback if db name is none
WBPREFIX = "wb_"
POOLS = {} # dict of txpostgres.ConnectionPools, one pool for each box/user combo

# changed by server.py if necessary
HOST = "localhost"
PORT = "5432"

def connect(db_name,db_user,db_pass):
    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))

    result_d = Deferred()
    if conn_str in POOLS:
        logging.debug("webbox_pg2: returning existing pool for db: {0}, user: {1}".format(db_name, db_user))
        pool = POOLS[conn_str]
        # already connected, so just return a defered with itself
        result_d.callback(pool)
    else:
        # not connected yet, so return after start() finished

        def success(pool):
            logging.debug("webbox_pg2: returning new pool for db: {0}, user: {1}, pool: {2}".format(db_name, db_user, pool))
            POOLS[conn_str] = pool # only do this if it successfully connects
            result_d.callback(pool)

        p = txpostgres.ConnectionPool(None, conn_str)
        p.start().addCallbacks(success, lambda failure: result_d.errback(failure))

    return result_d

def connect_sync(db_name, db_user, db_pass):
    """ Connect synchronously to the database - only used for large object support. """
    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))
    conn = psycopg2.connect(conn_str)
    return conn


def connect_raw(db_name, db_user, db_pass):
    """ Connect to the database bypassing the connection pool (e.g., for adding a notify observer). """

    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))
    conn = txpostgres.Connection()
    return conn.connect(conn_str)


def connect_box_sync(box_name, db_user, db_pass):
    return connect_sync(WBPREFIX + box_name, db_user, db_pass)

def connect_box_raw(box_name, db_user, db_pass):
    return connect_raw(WBPREFIX + box_name, db_user, db_pass)


def connect_box(box_name,db_user,db_pass):
    return connect(WBPREFIX + box_name, db_user, db_pass)


def auth(db_user,db_pass):
    d = Deferred()
    connect(None,db_user,db_pass).addCallbacks(lambda *x: d.callback(True), lambda *x: d.callback(False))
    return d


def list_databases(db_user, db_pass):
    return_d = Deferred()

    def db_list(rows):
        dbs = []
        for row in rows:
            db = row[0] # strip wb_ prefix from name
            dbs.append(db)
        return_d.callback(dbs)

    def connected(conn):
        conn.runQuery("SELECT datname FROM pg_database WHERE datname LIKE %s", [WBPREFIX+"%"]).addCallback(db_list)

    connect("postgres", db_user, db_pass).addCallback(connected)
    return return_d


def list_boxes(db_user, db_pass):
    return_d = Deferred()

    def db_list(dbs):
        boxes = []
        for db in dbs:
            box = db[len(WBPREFIX):]
            boxes.append(box)
        return_d.callback(boxes)

    d = list_databases(db_user, db_pass)
    d.addCallback(db_list)

    return return_d


def create_user(new_username, new_password, db_user, db_pass):
    """ Create a new user, and connect as the specified user.
    """
    return_d = Deferred()

    def created(conn, rows):
        conn.close() # close the connection
        return_d.callback(None)
        return

    def connected(conn):
        d = conn.runQuery("CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT CREATEDB NOCREATEROLE" % (new_username, new_password))
        d.addCallbacks(lambda rows: created(conn, rows), lambda failure: return_d.errback(failure))
        return

    connect("postgres", db_user, db_pass).addCallbacks(connected, lambda failure: return_d.errback(failure))
    return return_d


def create_box(box_name, db_user, db_pass):
    # create the database
    try:
        db_name = WBPREFIX + box_name 
        pg_conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(POSTGRES_DB, db_user, db_pass, HOST, PORT))
        root_conn = psycopg2.connect(pg_conn_str) # have to specify a db that exists
        root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        root_cur = root_conn.cursor()
        root_cur.execute("CREATE DATABASE %s WITH ENCODING='UTF8' OWNER=%s CONNECTION LIMIT=-1" % (db_name, db_user))
        root_conn.commit()
        root_cur.close()
        root_conn.close()

        # load in definition from data/objectstore-*.sql
        conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name, db_user, db_pass, HOST, PORT))
        root_conn = psycopg2.connect(conn_str) # reconnect to this new db, and without the isolation level set
        root_cur = root_conn.cursor()

        # ordered list of source database creation files
        source_files = ['objectstore-schema.sql', 'objectstore-views.sql', 'objectstore-functions.sql', 'objectstore-indexes.sql']
        for src_file in source_files:
            fh_objsql = open(os.path.join(os.path.dirname(__file__),"..","..","data",src_file)) # FIXME put into config
            objsql = fh_objsql.read()
            fh_objsql.close()
            root_cur.execute(objsql) # execute the sql from each file
            root_conn.commit() # commit per file

        root_cur.close()
        root_conn.close()
    except Exception as e:
        logging.error("Error creating box {0} as user {1}: {2}".format(box_name, db_user, e))
        return False

    return True

def create_role():
    
    return 


