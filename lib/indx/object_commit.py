#    Copyright (C) 2014 University of Southampton
#    Copyright (C) 2014 Daniel Alexander Smith
#    Copyright (C) 2014 Max Van Kleek
#    Copyright (C) 2014 Nigel R. Shadbolt
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
import time
import Crypto.Hash.SHA512
from twisted.internet.defer import Deferred

def sha512_hash(src):
    h = Crypto.Hash.SHA512.new()
    h.update(src)
    return h.hexdigest()

class ObjectCommit:

    def __init__(self, server_id, original_version, commit_id = None, date = None):
        logging.debug("ObjectCommit, commit_id: {0}".format(commit_id))
        self.server_id = server_id
        self.original_version = original_version
        self.date = date or time.strftime("%c") # now
        self.commit_id = commit_id

        if self.commit_id is None:
            self.commit_id = self.generate_id()

    def generate_id(self):
        """ Generate the commit log. """

        self.commit_log = "Date: {0}\nServer ID: {1}\nOriginal Version: {2}".format(self.date, self.server_id, self.original_version)
        commit_id = sha512_hash(self.commit_log)
        logging.debug("ObjectCommit generated ID {0} from log {1}".format(commit_id, self.commit_log))
        return commit_id

    def save(self, cur):
        """ Save this commit to a database, using the supplied cursor. """
        return_d = Deferred()

        query = "INSERT INTO ix_commits (commit_hash, date, server_id, original_version, commit_log) VALUES (%s, %s, %s, %s, %s)"
        params = [self.commit_id, self.date, self.server_id, self.original_version, self.commit_log]

        cur.execute(query, params).addCallbacks(return_d.callback, return_d.errback)
        return return_d

