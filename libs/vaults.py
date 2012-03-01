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

class Vaults:
    def __init__(self, vaults_file):
        self.vaults = shelve.open(vaults_file)

    def get_all(self):
        all_vaults = []
        for key in self.vaults.keys():
            all_vaults.append(self.vaults[key])
        return all_vaults

    def set_key(self, shortname, hashed):
        if self.vaults.has_key(shortname):
            if self.vaults[shortname].has_key("passwordhash"):
                logging.debug("hash already set on this vault")
                return "hash already set on this vault"
            existing = self.vaults[shortname]
            existing['passwordhash'] = hashed
            self.vaults[shortname] = existing
            self.vaults.sync()
            logging.debug("hash set to vault")
            return True

        logging.debug("vault does not exist")
        return "vault does not exist"

    def get(self, shortname):
        return self.vaults[shortname]

    def create(self, shortname, name):
        if not self.vaults.has_key(shortname):
            self.vaults[shortname] = {
                "name": name,
                "shortname": shortname,
                "url": "vaults/"+shortname, # FIXME move elsewhere?
            }
            self.vaults.sync()
            # TODO anything required on any of the stores? (4store doesn't, check RWW)

