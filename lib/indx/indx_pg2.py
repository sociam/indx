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
import json
import uuid
from indx.connectionpool import IndxConnectionPool
from txpostgres import txpostgres
from hashing_passwords import make_hash, check_hash
from indx.crypto import encrypt, rsa_encrypt, rsa_decrypt
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from indx.user import IndxUser

POOLS = {} # dict of txpostgres.ConnectionPools, one pool for each box/user combo
POOLS_BY_DBNAME = {} # dict of above indexed by dbname, used to close pools when databases are deleted

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

    def connect_indx_db(self):
        """ Connect to the indx database. """
        return connect(self.db_name, self.db_user, self.db_pass)


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
        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d

    def set_server_var(self, key, value, boxid = None):
        logging.debug("IndxPG2: set_server_var, key: {0}, value: {1}, boxid: {2}".format(key, value, boxid))
        return_d = Deferred()
        # TODO do this in a transaction

        def connected_cb(conn):
            logging.debug("IndxPG2: set_server_var connected_cb")

            def existing_cb(prev_value):
                logging.debug("IndxPG2: set_server_var existing_cb")
            
                if prev_value is not None:
                    # UPDATE existing
                    if boxid is None:
                        query = "UPDATE tbl_indx_core SET value = %s WHERE key = %s AND boxid IS NULL"
                        params = [value, key]
                    else:
                        query = "UPDATE tbl_indx_core SET value = %s WHERE key = %s AND boxid = %s"
                        params = [value, key, boxid]
                else:
                    # INSERT a new value
                    query = "INSERT INTO tbl_indx_core (key, value, boxid) VALUES (%s, %s, %s)"
                    params = [key, value, boxid]

                conn.runOperation(query, params).addCallbacks(return_d.callback, return_d.errback)

            self.get_server_var(key, boxid = boxid).addCallbacks(existing_cb, return_d.errback)

        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def get_server_var(self, key, boxid = None):
        logging.debug("IndxPG2: get_server_var, key: {0}, boxid: {1}".format(key, boxid))
        return_d = Deferred()

        if boxid is None:
            query = "SELECT value FROM tbl_indx_core WHERE key = %s AND boxid IS NULL"
            params = [key]
        else:
            query = "SELECT value WHERE tbl_indx_core key = %s AND boxid = %s"
            params = [key, boxid]

        def connected_cb(conn):
            logging.debug("IndxPG2: get_server_var connected_cb")

            def result_cb(rows):
                logging.debug("IndxPG2: get_server_var result_cb")

                if len(rows) < 1:
                    return_d.callback(None)
                else:
                    value = rows[0][0]
                    return_d.callback(value)

            conn.runQuery(query, params).addCallbacks(result_cb, return_d.errback)

        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def schema_upgrade(self, conn):
        """ Perform INDX schema upgrades.
        
            conn -- Connection to INDX database.
        """
        return_d = Deferred()

        fh_schemas = open(os.path.join(os.path.dirname(__file__),"..","data","indx-schemas.json")) # FIXME put into config
        schemas = json.load(fh_schemas)

        def upgrade_from_version(next_version):
            """ Upgrade the schema from the specified version. """
            logging.debug("indx_pg2: schema_upgrade from next_version {0}".format(next_version))

            sql_total = []
            last_version = next_version # keep track of the last applied version - this will be saved in the tbl_indx_core k/v table
            while next_version != "":
                logging.debug("indx_pg2: schema_upgrade adding sql from version: {0}".format(next_version))
                sql_total.append("\n".join(schemas['updates']['versions'][next_version]['sql']))
                last_version = next_version
                if 'next-version' not in schemas['updates']['versions'][next_version]:
                    break

                next_version = schemas['updates']['versions'][next_version]['next-version']

            logging.debug("indx_pg2: schema_upgrade saving last_version as {0}".format(last_version))
            sql_total.append("DELETE FROM tbl_indx_core WHERE key = 'last_schema_version';")
            sql_total.append("INSERT INTO tbl_indx_core (key, value) VALUES ('last_schema_version', '" + last_version + "');")

            # execute queries one at a time
            def do_next_query(empty):
                if len(sql_total) < 1:
                    return_d.callback(None)
                else:
                    query = sql_total.pop(0)
                    conn.runOperation(query).addCallbacks(do_next_query, return_d.errback)

            do_next_query(None)


        def table_cb(rows):
            exists = rows[0][0]
            if not exists:
                # start from first version
                first_version = schemas['updates']['first-version']
                upgrade_from_version(first_version)
                return
            else:
                # query from a version onwards
                query = "SELECT value FROM tbl_indx_core WHERE key = %s"
                params = ['last_schema_version']

                def version_cb(rows):
                    if len(rows) < 1:
                        # no previous version
                        first_version = schemas['updates']['first-version']
                        upgrade_from_version(first_version)
                        return
                    else:
                        this_version = rows[0][0]
                        if 'next-version' in schemas['updates']['versions'][this_version]:
                            next_version = schemas['updates']['versions'][this_version]['next-version']
                        else:
                            return_d.callback(True)
                            return # no next version

                        if next_version == "":
                            return_d.callback(True)
                            return # no next version

                        upgrade_from_version(next_version)
                        return

                conn.runQuery(query, params).addCallbacks(version_cb, return_d.errback)
                return

        conn.runQuery("select exists(select * from information_schema.tables where table_name=%s)", ["tbl_indx_core"]).addCallbacks(table_cb, return_d.errback)
        return return_d

    def get_server_id(self):
        logging.debug("IndxPG2: get_server_id")
        return_d = Deferred()

        def serverid_cb(server_id):
            logging.debug("IndxPG2: get_server_id, existing id is: {0}".format(server_id))
            if server_id is not None:
                # already set
                return_d.callback(server_id)
                return

            logging.debug("IndxPG2: get_server_id, generating new id, is: {0}".format(server_id))
            server_id = "{}".format(uuid.uuid1())
            self.set_server_var("server_id", server_id).addCallbacks(lambda done: return_d.callback(server_id), return_d.errback)

        self.get_server_var("server_id").addCallbacks(serverid_cb, return_d.errback)
        return return_d


    def check_indx_db(self):
        """ Check the INDX db exists, and create if it doesn't. """
        logging.debug("IndxPG2: check_indx_db")
        return_d = Deferred()

        def connected_cb(conn):
            d = conn.runQuery("SELECT 1 from pg_database WHERE datname='{0}'".format(self.db_name))

            def serverid_cb(empty):
                # post-schema upgrade
                self.get_server_id().addCallbacks(lambda success: return_d.callback(True), return_d.errback)


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

                            def schema_cb(empty):

                                def serverid_cb(empty):
                                    self.get_server_id().addCallbacks(lambda success: return_d.callback(True), return_d.errback)

                                self.schema_upgrade(conn_indx).addCallbacks(serverid_cb, return_d.errback)

                            conn_indx.runOperation(queries).addCallbacks(schema_cb, return_d.errback)

                        self.connect_indx_db().addCallbacks(connect_indx, return_d.errback)

                    d2.addCallbacks(create_cb, return_d.errback)
                else:
                    def connect_indx(conn_indx):
                        self.schema_upgrade(conn_indx).addCallbacks(serverid_cb, return_d.errback)

                    self.connect_indx_db().addCallbacks(connect_indx, return_d.errback)


            d.addCallbacks(check_cb, return_d.errback)

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected_cb, return_d.errback)
        return return_d


    def remove_database_users(self, db_name):
        """ Remove database users for a named database. """
        logging.debug("indx_pg2, remove_database_users: {0}".format(db_name))
        return_d = Deferred()

        operations = []

        def do_operations(conn):
            """ Perform final operations, performed after ROLEs are found and removed. """
            logging.debug("indx_pg2, remove_database_users: do_operations, len(operations): {0}".format(len(operations)))
            if len(operations) < 1:
                return_d.callback(None)
                return
            
            operation_query = operations.pop(0)
            d_db = conn.runOperation(operation_query)
            d_db.addCallbacks(lambda nothing: do_operations(conn), return_d.errback)
            return

        def connected_cb(conn):
            logging.debug("indx_pg2, remove_database_users: connected_cb, conn: {0}".format(conn))

            def db_user_cb(rows):
                logging.debug("indx_pg2, remove_database_users: db_user_cb, rows: {0}".format(rows))
                users_processed = {}
                for row in rows:
                    db_user = row[0]
                    if db_user not in users_processed:
                        users_processed[db_user] = True
                        operations.append("DROP ROLE %s" % db_user)
                
                do_operations(conn)
                return

            operations.append("DELETE FROM tbl_keychain WHERE db_name = '%s'" % db_name)
            d = conn.runQuery("SELECT db_user FROM tbl_keychain WHERE db_name = %s", [db_name])
            d.addCallbacks(db_user_cb, return_d.errback)
            return

        # get connection to INDX database from POOL
        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def create_database_and_users(self, conn_newdb, db_name, creation_queries):
        """ Create new database users for a specific database, one with read-write access, and one with read access.
        """
        return_d = Deferred()

        rw_user = "{0}_rw".format(db_name)
        rw_user_pass = binascii.b2a_hex(os.urandom(16))
        ro_user = "{0}_ro".format(db_name)
        ro_user_pass = binascii.b2a_hex(os.urandom(16))

        # queries to be run by INDX user on INDX db
        queries = [
            "CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE" % (rw_user, rw_user_pass),
            "CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE" % (ro_user, ro_user_pass),        
            "GRANT %s TO %s" % (rw_user, self.db_user), # make indx user a member of the rw user role (required)
            "ALTER DATABASE %s OWNER TO %s" % (db_name, rw_user),
            "GRANT ALL PRIVILEGES ON DATABASE %s TO %s" % (db_name, rw_user),
        ]

        def connected(conn_indx):
            if len(queries) < 1:

                def connected_rw_user_cb(conn_rw_user):

                    def created_cb(empty):

                        queries_db = [
                            "GRANT SELECT ON ALL TABLES IN SCHEMA public TO %s" % (ro_user),
                        ]

                        def inner_queries_cb(empty):
                            if len(queries_db) < 1:

                                return_d.callback((rw_user, rw_user_pass, ro_user, ro_user_pass))
                            else: 
                                query_db = queries_db.pop(0)
                                d_db = conn_rw_user.runOperation(query_db)
                                d_db.addCallbacks(inner_queries_cb, return_d.errback)

                        inner_queries_cb(None)

                    # run database schema/view/function creation queries as the rw_user
                    conn_rw_user.runOperation(creation_queries).addCallbacks(created_cb, return_d.errback)

                connect(db_name, rw_user, rw_user_pass).addCallbacks(connected_rw_user_cb, return_d.errback)
            else:
                query = queries.pop(0)
                d = conn_indx.runOperation(query)
                d.addCallbacks(lambda nothing: connected(conn_indx), return_d.errback)

        #c get connection to INDX database from POOL
        self.connect_indx_db().addCallbacks(connected, return_d.errback)
        return return_d


    def create_user(self, new_username, new_password, typ):
        """ Create a new INDX user. """
        return_d = Deferred()

        pw_hash = make_hash(new_password)
        pw_encrypted = encrypt(new_password, self.db_pass)

        def connected(conn):
            d = conn.runOperation("INSERT INTO tbl_users (username, username_type, password_hash, password_encrypted) VALUES (%s, %s, %s, %s)",[new_username, typ, pw_hash, pw_encrypted])

            def added_cb(empty):
                user = IndxUser(self, new_username)
                user.generate_encryption_keys().addCallbacks(lambda *x: return_d.callback(None), return_d.errback)

            d.addCallbacks(added_cb, return_d.errback)
            return

        self.connect_indx_db().addCallbacks(connected, return_d.errback)
        return return_d


    def missing_key_check(self):
        """ Check for missing private/public key pairs for any users. """
        logging.debug("indx_pg2 missing_key_check")
        return_d = Deferred()

        def connected_cb(conn):
            logging.debug("indx_pg2 missing_key_check, connected_cb")

            def check_cb(rows):
                logging.debug("indx_pg2 missing_key_check, check_cb")

                def do_next_row(empty):
                    logging.debug("indx_pg2 missing_key_check, do_next_row")
                    
                    if len(rows) < 1:
                        return_d.callback(True)
                        return

                    new_username = rows.pop(0)[0]
                    user = IndxUser(self, new_username)
                    user.generate_encryption_keys().addCallbacks(do_next_row, return_d.errback)

                do_next_row(None)

            d = conn.runQuery("SELECT username FROM tbl_users WHERE public_key_rsa IS NULL or private_key_rsa_env IS NULL", [])
            d.addCallbacks(check_cb, return_d.errback)
            return

        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def transfer_keychain_users(self, box_name, from_user, to_user, user_types):
        """ Transfer keychain users from one user to another.
        
            Decrypt the password from one user, and re-encrypt with another user's credentials.
        """
        logging.debug("indx_pg2 transfer_keychain_users")
        return_d = Deferred()
        db_name = INDX_PREFIX + box_name

        def connected_cb(conn):
            logging.debug("indx_pg2 transfer_keychain_users, connected_cb")

            def keys_cb(keys):
                logging.debug("indx_pg2, transfer_keychain_users, connected_cb, keys_cb")
                
                # FIXME we will need to decrypt private key somehow
                private_key = keys['private']

                def keys2_cb(keys2):
                    logging.debug("indx_pg2, transfer_keychain_users, connected_cb, keys2_cb")
                    public2_key = keys2['public']

                    def existing_cb(rows):
                        logging.debug("indx_pg2, transfer_keychain_users, connected_cb, existing_cb")
                        
                        def process_row(empty):

                            if len(rows) < 1:
                                return_d.callback(True)
                                return

                            row = rows.pop(0)
                            db_user, db_user_type, db_password_encrypted = row

                            if db_user_type not in user_types:
                                process_row(None)
                                return # next loop

                            db_password_clear = rsa_decrypt(private_key, db_password_encrypted)

                            db_password_new_encrypted = rsa_encrypt(public2_key, db_password_clear)

                            ins_q = "INSERT INTO tbl_keychain (user_id, db_name, db_user, db_user_type, db_password_encrypted) VALUES ((SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s)"
                            ins_p = [to_user, db_name, db_user, db_user_type, db_password_new_encrypted]

                            conn.runOperation(ins_q, ins_p).addCallbacks(process_row, return_d.errback)

                        process_row(None)


                    conn.runQuery("SELECT db_user, db_user_type, db_password_encrypted FROM tbl_keychain JOIN tbl_users ON (tbl_users.id_user = tbl_keychain.user_id) WHERE tbl_users.username = %s AND db_name = %s", [from_user, db_name]).addCallbacks(existing_cb, return_d.errback)

                to_user_obj = IndxUser(self, to_user)
                to_user_obj.get_keys().addCallbacks(keys2_cb, return_d.errback)

            from_user_obj = IndxUser(self, from_user)
            from_user_obj.get_keys().addCallbacks(keys_cb, return_d.errback)

        self.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def create_box(self, box_name, db_owner, db_owner_pass):
        """ Create a new database. """
        logging.debug("indx_pg2 create_box")
        return_d = Deferred()
        db_name = INDX_PREFIX + box_name 

        def connected(conn):
            logging.debug("indx_pg2 create_box, connected")

            def created(val):
                logging.debug("indx_pg2 create_box, created")

                def connected_newdb(conn_newdb):
                    logging.debug("indx_pg2 create_box, connected_newdb")
                    queries = ""
                    # ordered list of source database creation files
                    source_files = ['objectstore-schema.sql', 'objectstore-views.sql', 'objectstore-functions.sql', 'objectstore-indexes.sql']
                    for src_file in source_files:
                        fh_objsql = open(os.path.join(os.path.dirname(__file__),"..","data",src_file)) # FIXME put into config
                        objsql = fh_objsql.read()
                        fh_objsql.close()
                        queries += " " + objsql # concat operations together and run once below

                    def created_cb(user_details):
                        logging.debug("indx_pg2 create_box, created_cb")
                        rw_user, rw_user_pass, ro_user, ro_user_pass = user_details

                        def got_keys_cb(keys):
                            logging.debug("indx_pg2 create_box, got_keys_cb")

                            # assign ownership now to db_owner
                            rw_pw_encrypted = rsa_encrypt(keys['public'], rw_user_pass)
                            ro_pw_encrypted = rsa_encrypt(keys['public'], ro_user_pass)

                            def indx_db(conn_indx):
                                logging.debug("indx_pg2 create_box, indx_db")
                                d_q = conn_indx.runOperation("INSERT INTO tbl_keychain (user_id, db_name, db_user, db_user_type, db_password_encrypted) VALUES ((SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s), ((SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s)", [db_owner, db_name, rw_user, 'rw', rw_pw_encrypted, db_owner, db_name, ro_user, 'ro', ro_pw_encrypted])

                                def inserted(empty):
                                    logging.debug("indx_pg2 create_box, inserted, next ACL")

                                    acl_q = conn_indx.runOperation("INSERT INTO tbl_acl (database_name, user_id, acl_read, acl_write, acl_owner, acl_control) VALUES (%s, (SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s)", [box_name, db_owner, True, True, True, True])

                                    def inserted_acl(empty):
                                        logging.debug("indx_pg2 create_box, inserted_acl - create_box finished")
                                        return_d.callback(True)

                                    acl_q.addCallbacks(inserted_acl, return_d.errback)

                                d_q.addCallbacks(inserted, return_d.errback)

                            # connect to INDX db to add new DB accounts to keychain
                            self.connect_indx_db().addCallbacks(indx_db, return_d.errback)

                        user = IndxUser(self, db_owner)
                        user.get_keys().addCallbacks(got_keys_cb, return_d.errback)
                        
                    d = self.create_database_and_users(conn_newdb, db_name, queries)
                    d.addCallbacks(created_cb, return_d.errback)

                connect(db_name, self.db_user, self.db_pass).addCallbacks(connected_newdb, return_d.errback)
            
            d = conn.runOperation("CREATE DATABASE %s WITH ENCODING='UTF8' OWNER=%s CONNECTION LIMIT=-1" % (db_name, self.db_user))
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

    #this lists all boxes of all users
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
    
    #this lists all boxes of a particular user
    def list_user_boxes(self, username):
        return_d = Deferred()
        
        def connected(conn, username):
            logging.debug(conn)
            def db_list(rows):
                boxes = []
                for row in rows:
                    box = row[0][len(INDX_PREFIX):]
                    boxes.append(box)
                return_d.callback(boxes)

            conn.runQuery("SELECT DISTINCT tbl_keychain.db_name FROM tbl_keychain JOIN tbl_users ON (tbl_users.id_user = tbl_keychain.user_id) WHERE tbl_users.username = %s", [username]).addCallbacks(db_list, return_d.errback)

        self.connect_indx_db().addCallbacks(lambda conn: connected(conn,username), return_d.errback)
        return return_d


    def delete_box(self, box_name):
        # delete the database
        logging.debug("Delete box {0} req".format(box_name))
        return_d = Deferred()

        def connected(conn):
            d = conn.runOperation("DROP DATABASE {0}".format(db_name))

            def dropped_cb(val):
                self.remove_database_users(db_name).addCallbacks(lambda done: return_d.callback(True), return_d.errback)

            d.addCallbacks(dropped_cb, return_d.errback)

        db_name = INDX_PREFIX + box_name 
        if db_name in POOLS_BY_DBNAME:
            for pool in POOLS_BY_DBNAME[db_name]:
                pool.close()
                # TODO remove these from here, and from POOLS ?

        connect(POSTGRES_DB, self.db_user, self.db_pass).addCallbacks(connected, return_d.errback)
        return return_d

    def list_users(self):
        """ Create a new user, and connect as the specified user.
        """
        return_d = Deferred()

        def done(conn, rows):
            logging.debug("indx_pg2.list_users.done : {0}".format(repr(rows)))        
            users = []
            for r in rows:
                users.append({"@id": r[0], "type": r[1], "user_metadata": r[2] or {}})
            return_d.callback(users)

        def fail(err):
            logging.debug('indx_pg2.list_users failure >>>>>>> ');
            logging.error(err)
            return_d.errback(err)

        def connected(conn):
            logging.debug("indx_pg2.list_users : connected")
            d = conn.runQuery("SELECT DISTINCT username, username_type, user_metadata_json FROM tbl_users")
            d.addCallbacks(lambda rows: done(conn, rows), lambda failure: fail(failure))

        logging.debug('indx_pg2.list_users - connecting: {0}'.format(self.db_user))

        self.connect_indx_db().addCallbacks(connected, return_d.errback)
        return return_d


    def get_root_boxes(self, username = None):
        """ Get a list of the root boxes for each user. """
        logging.debug('indx_pg2 get_root_boxes')
        return_d = Deferred()

        def connected(conn):
            logging.debug("indx_pg2.get_root_boxes : connected")
            query = "SELECT DISTINCT username, root_box FROM tbl_users WHERE root_box IS NOT NULL"
            params = []

            if username is not None:
                query += " AND username = %s"
                params.append(username)

            d = conn.runQuery(query, params)
            d.addCallbacks(return_d.callback, return_d.errback)

        self.connect_indx_db().addCallbacks(connected, return_d.errback)
        return return_d


    def create_root_box(self, box_name, username, password):
        """ Create a new root box for the user name specified. """
        logging.debug("indx_pg2 create_root_box {0} for user {1}".format(box_name, username))
        result_d = Deferred()

        try:
            if username is None or username == "":
                raise Exception("Username cannot be blank, value was {0}".format(username))
            if box_name is None or box_name == "":
                raise Exception("Box Name cannot be blank, value was {0}".format(box_name))

            def created_cb(empty):
                logging.debug("indx_pg2 create_root_box created_cb")

                def connected_cb(conn):
                    logging.debug("indx_pg2 create_root_box connected_cb")

                    def do_acl(empty):
                        logging.debug("indx_pg2 create_root_box do_acl")
                        user = IndxUser(self, username)

                        user.set_acl(box_name, "@indx", {"read": True, "write": False, "control": False, "owner": False}).addCallbacks(result_d.callback, result_d.errback)

                    conn.runOperation("UPDATE tbl_users SET root_box = %s WHERE username = %s", [box_name, username]).addCallbacks(do_acl, result_d.errback)

                self.connect_indx_db().addCallbacks(connected_cb, result_d.errback)

            self.create_box(box_name, username, password).addCallbacks(created_cb, result_d.errback)

        except Exception as e:
            failure = Failure(e)
            logging.error("indx_pg2 create_root_box error, calling errback. Error is: {0}".format(e))
            result_d.errback(failure)

        return result_d


    def lookup_best_acct(self, box_name, box_user, box_pass):
        """ Lookup the best account (i.e. RW if exists, otherwise RO) for this user to this database. """
        db_name = INDX_PREFIX + box_name
        result_d = Deferred()

        def connected(conn):
            def queried(rows):
                if len(rows) < 1:
                    result_d.callback(False)
                    return

                if len(rows) > 1:
                    while len(rows) > 0:
                        row = rows.pop(0)
                        if row[1] == 'rw': # db_user_type is 'rw', then break, we have the best account type
                            break
                else:
                    row = rows[0]

                def got_keys_cb(keys):
                    logging.debug("indx_pg2 lookup_best_acct got_keys_cb")

                    # now row is the best account
                    db_user, db_user_type, db_password_encrypted = row
                    db_pass = rsa_decrypt(keys['private'], db_password_encrypted)
                    result_d.callback((db_user, db_pass))
                    return

                user = IndxUser(self, box_user)
                user.get_keys().addCallbacks(got_keys_cb, result_d.errback)

            conn.runQuery("SELECT tbl_keychain.db_user, tbl_keychain.db_user_type, tbl_keychain.db_password_encrypted FROM tbl_keychain JOIN tbl_users ON (tbl_users.id_user = tbl_keychain.user_id) WHERE tbl_users.username = %s AND tbl_keychain.db_name = %s", [box_user, db_name]).addCallbacks(queried, result_d.errback)

        self.connect_indx_db().addCallbacks(connected, result_d.errback)
        return result_d



# Connection Functions

def connect(db_name, db_user, db_pass):
    conn_str = ("dbname='{0}' user='{1}' password='{2}' host='{3}' port='{4}'".format(db_name or POSTGRES_DB, db_user, db_pass, HOST, PORT))

    result_d = Deferred()
    if conn_str in POOLS:
        logging.debug("indx_pg2: returning existing pool for db: {0}, user: {1}".format(db_name, db_user))
        p = POOLS[conn_str]
        # already connected, so just return a defered with itself
        result_d.callback(p)
    else:
        # not connected yet, so return after start() finished


        p = IndxConnectionPool(None, conn_str)

        def success(pool):
            logging.debug("indx_pg2: returning new pool for db: {0}, user: {1}, pool: {2}, p: {3}".format(db_name, db_user, pool, p))
            POOLS[conn_str] = p # only do this if it successfully connects
            if db_name not in POOLS_BY_DBNAME:
                POOLS_BY_DBNAME[db_name] = []
            POOLS_BY_DBNAME[db_name].append(p)
            result_d.callback(p)

        p.start().addCallbacks(success, result_d.errback)

    return result_d


def connect_sync(db_name, db_user, db_pass):
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
