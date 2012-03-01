#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


import uuid, os, sqlite3, logging

class Journal:
    """ A journal of all POSTs and PUTs to the store. """

    basedir = "data" + os.sep + "journals" # TODO customisable

    def __init__(self, journalid):
        """ Initialise with a journal. """
        # TODO connect to journal with id: "journalid"

        self.dir = Journal.basedir + os.sep + journalid
        self.db = Journal.basedir + os.sep + journalid + ".sqlite"
        
        if not os.path.exists(self.dir):
            os.makedirs(self.dir)

        exists = os.path.exists(self.db)
        self.conn = sqlite3.connect(self.db)

        if not exists:
            logging.debug("journal db (%s) does not exist, initialising" % self.db)
            self._initdb()


    def _initdb(self):
        """ Create a new DB to file self.db """

        # create a new table
        c = self.conn.cursor()

        # e.g. 0, deadbeef : 1, f00ba4 etc (the order of the repository hashes)
        c.execute("create table repository_versions (theorder INTEGER PRIMARY KEY AUTOINCREMENT, hash text)")
        self.conn.commit()
        # the graph uris that changed with this repository hash e.g. deadbeef, http://danielsmith.eu/dan : deadbeef, http://hip.cat/ etc
        c.execute("create table version_uris (hash text, uri text)")
        self.conn.commit()

        c.close()

    
    def add(self, repository_hash, uris):
        """ Add uris to a new version. """

        # add the repository hash, 'theorder' is auto incremented
        self.conn.execute("insert into repository_versions (hash) values (?)", [repository_hash])
        self.conn.commit()

        for uri in uris:
            self.conn.execute("insert into version_uris (hash, uri) values (?,?)", [repository_hash,uri])
            self.conn.commit()
    
    def get_version_hashes(self):
        """ Returns the current and previous versions of the repository. """
        c = self.conn.cursor()
        c.execute("select hash from repository_versions order by theorder desc limit 2")
        hashes = {"current": None, "previous": None}

        first = True
        for row in c:
            if first:
                hashes["current"] = str(row[0])
                first = False
            else:
                hashes["previous"] = str(row[0])

        return hashes

    def since(self, repository_hash):
        """ All changed URIs since this version (if any). """

        c = self.conn.cursor()
        if repository_hash is not None:
        
            c.execute("select theorder from repository_versions where hash = ?", [repository_hash])

            rowid = 0
            for row in c:
                rowid = row[0]
        
        else:
            rowid = 0

        uris = {}
        c.execute("select version_uris.uri from repository_versions join version_uris on (repository_versions.hash = version_uris.hash) where repository_versions.theorder > ?", [rowid])

        for row in c:
            uris[row[0]] = True

        return uris.keys()
        


#    def append(self, URIs, method, data, ctype):
#        """ New data with an identifier: "URI", a method (POST/PUT to replace/append), the "data" itself, which has a Content-Type "ctype". """
#        pass

#    def replay(self):
#        """ Replay the journal from the start into the store. """
#        pass

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    j = Journal("testjournal")
    j.add("deadb33f", ["http://danielsmith.eu/me#dan"])
    j.add("deadb33f2", ["http://danielsmith.eu/me#dan", "http://hip.cat"])
    j.add("deadb33f3", ["http://hip.cat"])

    print str(j.since("deadb33f"))
    print str(j.since("deadb33f2"))
    print str(j.since("deadb33f3"))

