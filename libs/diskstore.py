#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
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
#    along with INDX.  If not, see <http://www.gnu.org/licenses/>.


import sqlite3, os, os.path

class DiskStore:
    """ A storage class for storing key/value pairs of strings on disk. """
    """ This replaces the use of shelve in WebBox because of issues with dbm/cpickle and segmentation faults."""

    def __init__(self, filename):
        """ Open a database with this file, set up the table(s) if they dont exist. """

        exists = os.path.exists(filename)
        conn = sqlite3.connect(filename)

        if not exists:
            # create a new table
            c = conn.cursor()
            c.execute("create table pairs (key text, value text)")
            conn.commit()
            c.close()

        self.conn = conn

    def _safe_stringify(self, key):
        """ Turn a rdflib (or whatever) object into an ascii string to use as a key/value, ignore unicode errors. """
        u = unicode(key)
        a = u.encode("ascii", "replace") # replace means that non-ascii characters are replaced with a '?'
        return a

    def set(self, key, values):
        """ Set a value, removing existing if exists. """
        key = self._safe_stringify(key)

        self.conn.execute("delete from pairs where key = ?", [key])

        for value in values:
            value = self._safe_stringify(value)
            self.conn.execute("insert into pairs (key, value) values (?,?)", [key,value])
            self.conn.commit()

    def get(self, key):
        """ Get a value based on a key. """
        key = self._safe_stringify(key)

        c = self.conn.cursor()
        c.execute("select value from pairs where key = ?", [key])

        values = []
        for row in c:
            value = row[0]
            values.append(value)

        return values

        


