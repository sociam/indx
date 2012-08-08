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
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


import hashlib, logging, os
from diskstore import DiskStore


class Subscriptions:

    def __init__(self, subscriptions_file):
        """ Open/create a subscriptions list for the named webbox URI. """
        self.store = DiskStore(subscriptions_file)

    def _safe_hash(self, key):
        """ Turn a rdflib (or whatever) object into an ascii string to use as a DBM/Shelve key, ignore unicode errors. """
        u = unicode(key)
        a = u.encode("ascii", "replace") # replace means that non-ascii characters are replaced with a '?'
        return hashlib.sha256(a).hexdigest() # hash

    def subscribe(self, person_uri, resource_uri):
        """ Subscribe person to resource. """

        subscribers = self._get(resource_uri)
        
        if person_uri not in subscribers:
            subscribers.append(person_uri)
            self._add({resource_uri: subscribers})

        return None # success


    def unsubscribe(self, person_uri, resource_uri):
        """ Unsubscribe person from resource. """

        subscribers = self._get(resource_uri)
        
        if person_uri in subscribers:
            subscribers.remove(person_uri)
            self._add({resource_uri: subscribers})

        return None # success

    def get_subscribers(self, resource_uri):
        """ Get a list of subscribers for a resource. """
        
        subscribers = self._get(resource_uri)
        if subscribers is None:
            subscribers = []

        return subscribers

    def _add(self, hashes):
        for key in hashes:
#            self.store[self._safe_hash(key)] = hashes[key]
            self.store.set(key, hashes[key])
#        self.store.sync()

    def _get(self, hashed):
        return self.store.get(hashed)

#        if hashed in self.store:
#            return self.store[hashed]
#        else:
#            return None

