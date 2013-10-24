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
from twisted.internet.defer import Deferred
from hashing_passwords import make_hash, check_hash

class IndxUser:
    """ INDX User handler. """

    def __init__(self, db, username):
        logging.debug("IndxUser, username: {0}".format(username))
        self.db = db
        self.username = username

    def set_password(self, password):
        """ Set the user's password. """
        logging.debug("IndxUser, set_password for user {0}".format(self.username))
        return_d = Deferred()
        
        pw_hash = make_hash(password)

        def connected_d(conn):
            logging.debug("IndxUser, set_password, connected_d")
            insert_q = "UPDATE tbl_users SET password_hash = %s WHERE username = %s"
            insert_p = [pw_hash, self.username]

            def inserted_d(empty):
                logging.debug("IndxUser, set_password, connected_d, inserted_d")
                return_d.callback(True)
                return

            conn.runOperation(insert_q, insert_p).addCallbacks(inserted_d, return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_d, return_d.errback)
        return return_d


    def get_user_metadata(self):
        """ Get user's metadata."""
        logging.debug("IndxUser, get_user_metadata for username {0}".format(self.username))
        return_d = Deferred()

        def connected_d(conn):
            logging.debug("IndxUser, get_user_metadata, connected_d")

            query = "SELECT user_metadata_json FROM tbl_users WHERE username = %s AND user_metadata_json IS NOT NULL"
            params = [self.username]

            def query_d(conn, rows):
                logging.debug("IndxUser, get_user_metadata, connected_d, query_d, rows: {0}".format(rows))

                if len(rows) < 1:
                    return_d.callback(None) # no user metadata
                else:
                    return_d.callback(json.loads(rows[0][0]))

            conn.runQuery(query, params).addCallbacks(lambda rows: query_d(conn, rows), return_d.errback)

        self.db.connect_indx_db().addCallbacks(connected_d, return_d.errback)

        return return_d


