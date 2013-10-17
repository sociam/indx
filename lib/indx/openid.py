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
from twisted.internet.defer import Deferred

class IndxOpenID:
    """ INDX OpenID handler ID. """

    def __init__(self, db, uri):
        logging.debug("IndxOpenID, uri: {0}".format(uri))
        self.db = db
        self.uri = uri

    def init_user(self):
        """ Check there is a user in the database, and initialise one if not.

            If there are pending permission requests, initialise them too.

            Callsback with an object with user details, e.g. the "password_hash" - if the password hash is empty, the user must be prompted to set a password.
        """
        logging.debug("IndxOpenID, init_user")
        return_d = Deferred()
        
        def connected_d(conn):
            logging.debug("IndxOpenID, init_user, connected_d")

            query = "SELECT username, username_type, password_hash FROM tbl_users WHERE username = %s AND username_type = %s"
            params = [self.uri, "openid"]
            
            def query_d(conn, rows):
                logging.debug("IndxOpenID, init_user, connected_d, query_d")

                if len(rows) < 1:
                    # user does not exist: create a new user in the table now, with empty password hash

                    insert_q = "INSERT INTO tbl_users (username, username_type, password_hash, password_encrypted) VALUES (%s, %s, %s, %s)"
                    insert_p = [self.uri, "openid", "", ""]

                    def inserted_d(empty):
                        logging.debug("IndxOpenID, init_user, connected_d, query_d, inserted_d")
                        return_d.callback({"password_hash": ""})
                        return

                    conn.runOperation(insert_q, insert_p).addCallbacks(inserted_d, return_d.errback)
                    
                else:
                    # user already exists, no init required here
                    password_hash = rows[0][2]
                    return_d.callback({"password_hash": password_hash}) # if password_hash is empty, user must be prompted to set a password
                    return

            conn.runQuery(query, params).addCallbacks(lambda rows: query_d(conn, rows), return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_d, return_d.errback)
        return return_d

