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
import json
from indx import UNAUTH_USERNAME
from twisted.internet.defer import Deferred
from hashing_passwords import make_hash, check_hash
from twisted.python.failure import Failure
from indx.crypto import generate_rsa_keypair, load_key

class IndxUser:
    """ INDX User handler. """

    RSA_KEYSIZE = 3072

    def __init__(self, db, username):
        logging.debug("IndxUser, username: {0}".format(username))
        self.db = db
        self.username = username

    def get_keys(self):
        """ Get the user's key pair from the database. """
        logging.debug("IndxUser, get_keys for user {0}".format(self.username))
        return_d = Deferred()

        # XXX TODO FIXME decrypt the private key

        def connected_cb(conn):
            logging.debug("IndxUser, get_keys, connected_cb")

            check_q = "SELECT public_key_rsa, private_key_rsa_env FROM tbl_users WHERE username = %s"
            check_p = [self.username]

            def check_cb(rows, *args, **kw):
                logging.debug("IndxUser, get_keys, connected_cb, check_cb")
                if len(rows) < 1:
                    return_d.callback(None)
                    return
                
                try:
                    return_d.callback({"public": load_key(rows[0][0]), "private": load_key(rows[0][1])})
                except Exception as e:
                    logging.error("IndxUser, get_keys, Exception loading keys from database: {0}".format(e))
                    return_d.errback(Failure(e))

            conn.runQuery(check_q, check_p).addCallbacks(check_cb, return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def generate_encryption_keys(self, overwrite = False):
        """ Generate and save encryption keys for this user.
        
            overwrite -- Force overwriting the keys if they already exist, default is False, which means that the function will check first and do nothing if they user already has encryption keys
        """
        logging.debug("IndxUser, generate_encryption_keys for user {0}".format(self.username))
        return_d = Deferred()

        # TODO FIXME XXX do this in a runInteraction transaction

        def connected_cb(conn):
            logging.debug("IndxUser, generate_encryption_keys, connected_cb")

            check_q = "SELECT EXISTS(SELECT * FROM tbl_users WHERE username = %s AND public_key_rsa IS NOT NULL AND private_key_rsa_env IS NOT NULL)"
            check_p = [self.username]

            def check_cb(rows, *args, **kw):
                logging.debug("IndxUser, generate_encryption_keys, connected_cb, check_cb")

                exists = rows[0][0]
                if exists and not overwrite:
                    return_d.callback(False)
                    return # already has keys, and we are not overwriting

                keys = generate_rsa_keypair(self.RSA_KEYSIZE)
                public_key = keys['public']
                private_key = keys['private'] # TODO FIXME XXX encrypt private key with password / client cert (decide mechanism)

                insert_q = "UPDATE tbl_users SET private_key_rsa_env = %s, public_key_rsa = %s WHERE username = %s"
                insert_p = [private_key, public_key, self.username]

                def insert_cb(empty):
                    logging.debug("IndxUser, generate_encryption_keys, insert_cb")
                    return_d.callback(True)

                conn.runOperation(insert_q, insert_p).addCallbacks(insert_cb, return_d.errback)

            conn.runQuery(check_q, check_p).addCallbacks(check_cb, return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def set_password(self, password):
        """ Set the user's password. """
        logging.debug("IndxUser, set_password for user {0}".format(self.username))
        return_d = Deferred()
        
        pw_hash = make_hash(password)

        def connected_cb(conn):
            logging.debug("IndxUser, set_password, connected_cb")
            insert_q = "UPDATE tbl_users SET password_hash = %s WHERE username = %s"
            insert_p = [pw_hash, self.username]

            def inserted_cb(empty):
                logging.debug("IndxUser, set_password, connected_cb, inserted_cb")
                return_d.callback(True)
                return

            conn.runOperation(insert_q, insert_p).addCallbacks(inserted_cb, return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d

    def get_user_info(self, decode_json = False):
        """ Get user's info (type, metadata) in one call, optionally decode user_metadata JSON string."""
        logging.debug("IndxUser, get_user_info for username {0}".format(self.username))
        return_d = Deferred()

        def connected_cb(conn):
            logging.debug("IndxUser, get_user_info, connected_cb")

            query = "SELECT username_type, user_metadata_json, username, root_box FROM tbl_users WHERE username = %s"
            params = [self.username]

            def query_cb(conn, rows):
                logging.debug("IndxUser, get_user_info, connected_cb, query_cb, rows: {0}".format(rows))

                if len(rows) < 1:
                    return_d.callback(None) # no user info available
                else:
                    typ, user_metadata, username, root_box = rows[0]
                    user_info = {"type": typ, "user_metadata": user_metadata or '{}', "username": username, "root_box": root_box}

                    if decode_json:
                        user_info['user_metadata'] = json.loads(user_info['user_metadata'])

                    return_d.callback(user_info)

            conn.runQuery(query, params).addCallbacks(lambda rows, *args, **kw: query_cb(conn, rows), return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d

    def get_acls(self, database_name):
        """ Get all ACLs for the specified database. """
        logging.debug("IndxUser, get_acls database_name {0}".format(database_name))
        return_d = Deferred()

        def connected_cb(conn):
            logging.debug("IndxUser, get_acls, connected_cb")

            query = "SELECT acl_read, acl_write, acl_owner, acl_control, tbl_users.username FROM tbl_acl JOIN tbl_users ON (tbl_users.id_user = tbl_acl.user_id) WHERE database_name = %s"
            params = [database_name]

            results = []
            def query_cb(conn, rows):
                logging.debug("IndxUser, get_acl, connected_cb, query_cb, rows: {0}".format(rows))

                for row in rows:
                    acl = {
                        "database": database_name,
                        "username": row[4],
                        "acl": {"read": row[0], "write": row[1], "owner": row[2], "control": row[3]}
                    }
                    results.append(acl)

                return_d.callback(results)

            conn.runQuery(query, params).addCallbacks(lambda rows, *args, **kwargs: query_cb(conn, rows), return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d


    def get_acl(self, database_name):
        """ Get the user's ACL permissions for specified database. """
        logging.debug("IndxUser, get_acl database_name {0} for user {1}".format(database_name, self.username))
        return_d = Deferred()

        def connected_cb(conn):
            logging.debug("IndxUser, get_acl, connected_cb")

            query = "SELECT acl_read, acl_write, acl_owner, acl_control FROM tbl_acl JOIN tbl_users ON (tbl_users.id_user = tbl_acl.user_id) WHERE database_name = %s AND tbl_users.username = %s"
            params = [database_name, self.username]

            def query_cb(conn, rows):
                logging.debug("IndxUser, get_acl, connected_cb, query_cb, rows: {0}".format(rows))

                if len(rows) < 1:
                    permissions = {"read": False, "write": False, "owner": False, "control": False} # no acl available, all permissions set to False
                else:
                    permissions = {"read": rows[0][0], "write": rows[0][1], "owner": rows[0][2], "control": rows[0][3]}

                # make an ACL object
                acl = {
                    "database": database_name,
                    "username": self.username,
                    "acl": permissions,
                }
                return_d.callback(acl)

            conn.runQuery(query, params).addCallbacks(lambda rows, *args, **kwargs: query_cb(conn, rows), return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d

    def set_acl(self, database_name, target_username, acl):
        """ Sets an ACL by this user, for a different target user.

            RULES (these are in box.py and in user.py)
            The logged in user sets an ACL for a different, target user.
            The logged in user must have a token, and the box of the token is the box that will have the ACL changed/set.
            If there is already an ACL for the target user, it will be replaced.
            The logged in user must have "control" permissions on the box.
            The logged in user can give/take read, write or control permissions. They cannot change "owner" permissions.
            If the user has owner permissions, it doesn't matter if they dont have "control" permissions, they can change anything.
            Only the user that created the box has owner permissions.
        """
        logging.debug("IndxUser, set_acl database_name {0} for target_username {1} for acl {2}".format(database_name, target_username, acl))
        return_d = Deferred()

        # verify that 'acl' is valid, throw Failure to errback if not
        try:
            # check that the properties all exist, and all values are booleans
            assert(type(acl['read']) == type(True))
            assert(type(acl['write']) == type(True))
            assert(type(acl['control']) == type(True))
        except Exception as e:
            logging.error("IndxUser, set_acl, error asserting types in 'acl', object is invalid: {0}, error: {1}".format(acl, e))
            return_d.errback(Failure(e))
            return return_d # immediately return


        # TODO FIXME XXX do this in a runInteraction transaction !

        def connected_cb(conn):
            logging.debug("IndxUser, set_acl, connected_cb")

            # verify the target user exists
            user_check_q = "SELECT EXISTS(SELECT * FROM tbl_users WHERE username = %s)"
            user_check_p = [target_username]

            def user_check_cb(rows, *args, **kw):
                logging.debug("IndxUser, set_acl, connected_cb, user_check_cb")
                present = rows[0][0] # EXISTS returns true/false 

                def post_user_cb(empty):

                    # verify logged in user has 'control' ACL permissions on that database
                    # or verify that have owner permissions (either mean they can change something)
                    acl_check_q = "SELECT acl_control, acl_owner FROM tbl_acl WHERE user_id = (SELECT id_user FROM tbl_users WHERE username = %s) AND DATABASE_NAME = %s"
                    acl_check_p = [self.username, database_name]

                    def acl_check_cb(rows, *args, **kw):
                        logging.debug("IndxUser, set_acl, connected_cb, acl_check_cb")
                        if len(rows) < 1:
                            e = Exception("User '{0}' does not have permission to make this ACL change to database '{1}'.".format(self.username, database_name))
                            failure = Failure(e)
                            return_d.errback(failure)
                            return
                        
                        existing_acl_control = rows[0][0]
                        existing_acl_owner = rows[0][1]

                        # check that logged in user is control or owner
                        if not (existing_acl_control or existing_acl_owner):
                            e = Exception("User '{0}' does not have permission to make this ACL change to database '{1}'.".format(self.username, database_name))
                            failure = Failure(e)
                            return_d.errback(failure)
                            return
                            

                        # read the existing ACL - read the owner value and keep it the same (prevent non-owner users from de-ownering the original owner)
       
                        acl2_check_q = "SELECT acl_owner FROM tbl_acl WHERE user_id = (SELECT id_user FROM tbl_users WHERE username = %s) AND DATABASE_NAME = %s"
                        acl2_check_p = [target_username, database_name]

                        def acl2_check_cb(rows, *args, **kw):
                            logging.debug("IndxUser, set_acl, connected_cb, acl2_check_cb")
     
                            if len(rows) < 1:
                                current_owner_value = False
                            else:
                                current_owner_value = rows[0][0]

                            # delete any pre-existing acl for this database and target user
                            del_query = "DELETE FROM tbl_acl WHERE database_name = %s AND user_id = (SELECT id_user FROM tbl_users WHERE username = %s)"
                            del_params = [database_name, target_username]

                            def del_query_cb(empty):
                                logging.debug("IndxUser, set_acl, connected_cb, del_query_cb")

                                def acl_done_cb(empty):
                                    logging.debug("IndxUser, set_acl, connected_cb, acl_done_cb")

                                    # only transfer the 'rw' user if the user has been given the 'write' permission
                                    # FIXME remove the 'rw' user row if their permission is revoked ?
                                    user_types = ['ro']
                                    if acl['write']:
                                        user_types.append('rw')

                                    def transfer_cb(empty):
                                        logging.debug("IndxUser, set_acl, connected_cb, transfer_cb")
                                        return_d.callback(True)

                                    self.db.transfer_keychain_users(database_name, self.username, target_username, user_types).addCallbacks(transfer_cb, return_d.errback)


                                # create a new ACL
                                conn.runOperation("INSERT INTO tbl_acl (database_name, user_id, acl_read, acl_write, acl_owner, acl_control) VALUES (%s, (SELECT id_user FROM tbl_users WHERE username = %s), %s, %s, %s, %s)", [database_name, target_username, acl['read'], acl['write'], current_owner_value, acl['control']]).addCallbacks(acl_done_cb, return_d.errback)

                            conn.runOperation(del_query, del_params).addCallbacks(del_query_cb, return_d.errback)
                           
                        conn.runQuery(acl2_check_q, acl2_check_p).addCallbacks(acl2_check_cb, return_d.errback)

                    conn.runQuery(acl_check_q, acl_check_p).addCallbacks(acl_check_cb, return_d.errback)

                # check if username is present in the db
                # if it isn't, but is the unauth user, then create the unauth user in the db
                if not present and target_username != UNAUTH_USERNAME:
                    e = Exception("User with username '{0}' does not exist.".format(target_username))
                    failure = Failure(e)
                    return_d.errback(failure)
                    return

                elif not present:
                    # create a new db user for the unauth user
                    self.db.create_user(UNAUTH_USERNAME, "", "internal").addCallbacks(post_user_cb, return_d.errback)
                else:
                    # continue without creating a user
                    post_user_cb(None)

            conn.runQuery(user_check_q, user_check_p).addCallbacks(user_check_cb, return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)
        return return_d

