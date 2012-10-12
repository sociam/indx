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

# import core modules
import sys, os, logging, json, shutil, getpass, re
from webserver import ObjectWebServer
import psycopg2

conn = psycopg2.connect(database="webbox", user="webbox", password="foobar")

config = {
    "port": 8215,
    "connection": conn,
}

# show debug messages in log file
logger = logging.getLogger() # root logger
logger.debug("Logger initialised")
logger.setLevel(logging.DEBUG)

server = ObjectWebServer(config)
server.run()

