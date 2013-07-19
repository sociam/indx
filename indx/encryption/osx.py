#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
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

import psutil, os, logging

class EncryptedDisk:
    """ Manages encrypted volumes, specifically for PostgreSQL table spaces. """

    def __init__(self, filename, mountpoint):
        """ filename is the disk image, mountpoint is where it gets mounted to. """
        self.filename = filename

        ending = ".sparsebundle"

        if self.filename[-len(ending)] != ending:
            self.filename = "{0}{1}".format(self.filename, ending)
            logging.debug("Renaming encrypted disk filename from {0} to {1}".format(filename, self.filename))

        self.mountpoint = mountpoint

    def get_filename(self):
        """ Retreive the filename (it may be different to the one specified in the constructor, e.g. to add .sparsebundle [under osx]). """
        return self.filename


    def create(self, password):
        """ Create a new disk at self.filename, encrypted with password. Skip if it already exists. """

        if os.path.exists(self.filename):
            logging.debug("Create of encrypted disk skipping - it already exists.")
            return True

        command = ["hdiutil",
                    "create",
                    "-size","10g",
                    "-fs","HFS+J",
                    "-encryption",
                    "-passphrase",password,
                    "-type","SPARSEBUNDLE",
                    "-volname","indx",
                    self.filename,
                  ]
        logging.debug("Attempting to create encrypted disk using command: {0}".format(" ".join(command)))
        p = psutil.Popen(command)
        p.wait(timeout=60)

        return os.path.exists(self.filename)


    def mount(self, password):
        """ Mount the encrypted volume self.filename, using password, at self.mountpoint. """

        if not os.path.exists(self.mountpoint):
            os.makedirs(self.mountpoint)

        command = ["hdiutil",
                    "attach",
                    "-mountpoint",self.mountpoint,
                    "-passphrase",password,
                    self.filename,
                  ]
        logging.debug("Attempting to attach encrypted disk using command: {0}".format(" ".join(command)))
        p = psutil.Popen(command)
        p.wait(timeout=60)

        return


    def unmount(self):
        """ Unmount the disk image. """

        command = ["hdiutil",
                    "detach",
                    self.mountpoint,
                  ]
        logging.debug("Attempting to detach encrypted disk using command: {0}".format(" ".join(command)))
        p = psutil.Popen(command)
        p.wait(timeout=60)

        return


