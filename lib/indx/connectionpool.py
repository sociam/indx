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

from txpostgres import txpostgres

class IndxConnectionPool:
    """ A wrapper for txpostgres connection pools, which auto-reconnects. """

    def __init__(self, _ignored, *connargs, **connkw):
        self.pool = txpostgres.ConnectionPool(_ignored, *connargs, **connkw)

    # Wrap existing functions
    def start(self, *args, **kwargs):
        return self.pool.start(*args, **kwargs)

    def close(self, *args, **kwargs):
        return self.pool.close(*args, **kwargs)

    def remove(self, *args, **kwargs):
        return self.pool.remove(*args, **kwargs)

    def add(self, *args, **kwargs):
        return self.pool.add(*args, **kwargs)

    # Wrap query functions with auto-reconnection
    def runQuery(self, *args, **kwargs):
        try:
            deferred = self.pool.runQuery(*args, **kwargs)
        except Exception as e:

        return self.pool.runQuery(*args, **kwargs)

    def start(self, *args, **kwargs):
        return self.pool.start(*args, **kwargs)
