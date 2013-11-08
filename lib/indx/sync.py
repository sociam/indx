#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
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

class IndxSync:
    """ Handle Indx Synchronisation of data across multiple boxes/servers. """

    def __init__(self, root_store, indx_db):
        """ Initialise with the root box and connection to the INDX db.
        
            root_store -- Connected objectstore to the root box.
            indx_db -- Connection to the INDX database.
        """
        logging.debug("IndxSync __init__ root_store {0}".format(root_store))

        self.root_store = root_store
        self.indx_db = indx_db

        root_store.listen(lambda *x: self.observer(*x))


    def observer(self, notify):
        """ Root box callback function returning an update. """
        logging.debug("IndxSync observer, notify: {0}".format(notify))

        def err_cb(failure):
            failure.trap(Exception)
            logging.error("IndxSync observer error from diff: {0}".format(failure))

        def diff_cb(data):
            logging.debug("IndxSync observer diff: {0}".format(data))
            # FIXME do something

        version = int(notify.payload)
        old_version = version - 1 # TODO do this a better way?

        self.root_store.diff(old_version, version, "diff").addCallbacks(diff_cb, err_cb)

