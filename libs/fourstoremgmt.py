#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
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

import psutil, os, logging, time

class FourStoreMgmt:
    """ Manages 4store processes. """

    def __init__(self, kbname, http_port=None, delay=0):
        self.kbname = kbname
        self.http_port = http_port
        self.pid_list = None
        self.delay = delay
        self.new()

    def new(self, fs_base="/var/lib/4store"):
        """ Create a new store. """
        loc = fs_base + os.sep + self.kbname

        if os.path.exists(loc):
            return # already exists
        else:
            logging.debug("Creating new 4store: "+self.kbname)
            os.mkdir(loc)
            psutil.Popen(["4s-backend-setup", self.kbname])
            time.sleep(5)

    def killall(self, process):
        logging.debug("Killing process: "+str(process.pid)+" : "+str(process))
        children = process.get_children(recursive=True)
        process.kill()
        # kill children too, sometimes they stick around
        for child in children:
            child.kill()
        
    def stop(self):
        if self.pid_list is None:
            # find by searching, because we didn't start it
            pids = psutil.process_iter()
            for pid in pids:
                try:
                    if pid.name == "4s-backend" or pid.name == "4s-httpd":
                        attrs = pid.as_dict()
                        if self.kbname in attrs['cmdline']: # FIXME pretty rough
                            self.killall(pid)

                except Exception as e:
                    # AccessDenied, ignore
                    pass
        else:
            # kill the processes that we started
            for process in self.pid_list:
                self.killall(process)

    def start(self):
        self.pid_list = []

        backend_pid = psutil.Popen(["4s-backend","-D",self.kbname])
        self.pid_list.append(backend_pid)

        if self.delay > 0:
            time.sleep(self.delay)

        if self.http_port is not None:
            httpd_pid = psutil.Popen(["4s-httpd","-D","-p",str(self.http_port),self.kbname])
            self.pid_list.append(httpd_pid)

