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
from indx.user import IndxUser

class IndxOpenID:
    """ INDX OpenID handler. """

    def __init__(self, db, uri):
        logging.debug("IndxOpenID, uri: {0}".format(uri))
        self.db = db
        self.uri = uri

    def init_user(self, new_user_metadata):
        """ Check there is a user in the database, and initialise one if not.

            If there are pending permission requests, initialise them too.

            Callsback with an object with user details.
        """
        logging.debug("IndxOpenID, init_user")
        return_d = Deferred()
        
        user = IndxUser(self.db, self.uri)

        def info_cb(user_metadata):
            logging.debug("IndxOpenID, init_user, info_cb user_metadata: {0}".format(user_metadata))

            if user_metadata is None:
                # user does not exist: create a new user in the table now, with empty password hash

                def connected_cb(conn):
                    user_metadata_json = json.dumps(new_user_metadata)

                    insert_q = "INSERT INTO tbl_users (username, username_type, password_hash, password_encrypted, user_metadata_json) VALUES (%s, %s, %s, %s, %s)"
                    insert_p = [self.uri, "openid", "", "", user_metadata_json]

                    def inserted_d(empty):
                        logging.debug("IndxOpenID, init_user, connected_d, query_d, inserted_d")
                        user.get_user_info(decode_json = False).addCallbacks(return_d.callback, return_d.errback)

                    conn.runOperation(insert_q, insert_p).addCallbacks(inserted_d, return_d.errback)
                
                self.db.connect_indx_db().addCallbacks(connected_cb, return_d.errback)

            else:
                # user already exists, no init required here
                return_d.callback(user_metadata)

        user.get_user_info(decode_json = False).addCallbacks(info_cb, return_d.errback)
        return return_d

