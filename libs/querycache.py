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


import shelve, hashlib

class QueryCache:
    def __init__(self, cache_file):
        self.store = shelve.open(cache_file)

    def hash_query_and_key(self, query, key):
        if key is None:
            key = ""
        return hashlib.sha256(query + "::::" + key).hexdigest() 

    def add(self, query, key, results):
        pass
#        self.store[self.hash_query_and_key(query, key)] = results
#        self.store.sync()

    def get(self, query, key):
        return None
#        hashed = self.hash_query_and_key(query, key)
#        if not self.store.has_key(hashed):
#            return None
#
#        return self.store[hashed]

    def empty(self):
        pass
#        for key in self.store:
#            del self.store[key] # is this the best way? I can't find a .empty() or .clear() equivalent
#
#        self.store.sync()
