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


import shelve, logging

from diskstore import DiskStore

class HashStorage:
    def __init__(self, hashstore_file):
        #self.store = shelve.open(hashstore_file)
        self.store = DiskStore(hashstore_file)

#    def _safe_hash(self, key):
#        """ Turn a rdflib (or whatever) object into an ascii string to use as a DBM/Shelve key, ignore unicode errors. """
#        u = unicode(key)
#        a = u.encode("ascii", "replace") # replace means that non-ascii characters are replaced with a '?'
#        return a

    def add(self, hashes):
        logging.debug("hashstore: add of %s" % str(hashes))
        for key in hashes:
            logging.debug("hashstore: adding key %s" % str(key))
#            self.store[self._safe_hash(key)] = hashes[key]
            self.store.set(key, [ hashes[key] ])
#        logging.debug("hashstore: about to sync")
#        self.store.sync()
#        logging.debug("hashstore: synced")

    def get(self, hashed):
#        hashed = self._safe_hash(hashed)
#        return self.store[hashed]

        values = self.store.get(hashes)
        if len(values) == 0:
            return None
        else:
            return values[0]

    def get_list(self, hash_list):
        results = {}
        for hash_ in hash_list:
            #results[hash_] = self.store[hash_]
            values = self.store.get(hash_)
            if len(values) == 0:
                results[hash_] = None
            else:
                results[hash_] = values[0]
        return results

