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


import logging, ConfigParser, traceback
import cherrypy.lib.encoding

from cherrypy import HTTPError # an exception raised by cherrypy when you send 4xx or 5xx status
from journal import Journal

# show debug messages in console
logging.basicConfig(level=logging.DEBUG)

# read the config file
config = ConfigParser.ConfigParser()
config.read("securestore.cfg")

# import SecureStore module
from securestore import SecureStore
ss = SecureStore(config)

# register the WebBox module under the name "webbox" - this name is then used in the config file to define paths
from webbox import WebBox
ss.enable_module(WebBox, "webbox")
ss.register_module("webbox", "/webbox")

# register the certificate generation JSON module
from certificates import Certificates
ss.enable_module(Certificates, "certificates")
ss.register_module("certificates", "/certificates")

# register the journal update module
from journalmodule import JournalModule
ss.enable_module(JournalModule, "journal")
ss.register_module("journal", "/update")



# register and set the query store to 4store
from fourstore import FourStore
ss.set_query_store(FourStore)

# register and set the query store to the in-memory pure python CwmStore
#from cwm import CwmStore
#ss.setQueryStore(CwmStore)


def securestore_wsgi(environ, start_response):
    global ss

#    def ws(self):
#        logging.debug("ws (websockets function) called in securestore_wsgi")
        

    class SecureStoreWSGI:
        code = None
        headers = []
        compressable = [
            'text/html',
            'text/javascript',
            'text/css',
            'text/plain',
        ]

        def __init__(self, environ, start_response):
            self.environ = environ
            self.start_response = start_response

        def respond(self):
            # handle the request
            logging.debug("Handling a request.")

            try:
                try:
                    response = ss.request(self.environ, self.my_start_response)
                except Exception as e:
                    logging.debug("Got HTTP Error.")
                    logging.debug(str(e))
                    logging.debug(traceback.format_exc())

                    ctype = "text/plain"

                    # wow. so apparently we have to do this now. hm
                    if hasattr(e, "code"):
                        logging.debug("sending code")
                        start_response(str(e.code), [("Content-Type", ctype)])
                    elif hasattr(e, "status"):
                        logging.debug("sending status")
                        start_response(str(e.status), [("Content-Type", ctype)])

                    # TODO figure out how to get the REAL error back.
                    return "Error."
            except Exception as e:
                """ Global error handling, something very bad happened. """
                logging.error("GLOBAL ERROR: " + str(e))
                start_response("500", [('Content-Type','text/plain')])
                return "Unknown Error."


            # FIXME compressing seems slower than not at the moment, so skipping
#            response2 = self.compress(response)
            response2 = response

            # put repository version weak ETag header
            # journal to load the original repository version
            j = Journal(config.get("securestore", "journalid"))
            latest_hash = j.get_version_hashes() # current and previous
            
            if latest_hash['current'] is not None:
                self.headers.append( ('ETag', "W/\"%s\""%latest_hash['current'] ) ) # 'W/' means a Weak ETag
            if latest_hash['previous'] is not None:
                self.headers.append( ('X-ETag-Previous', "W/\"%s\""%latest_hash['previous']) ) # 'W/' means a Weak ETag

            start_response(self.code, self.headers)

            return response2

        def compress(self, response):
            compressed = None
            for header in self.headers:
                if header[0].lower() == 'content-type' and header[1] in self.compressable:
                    # compress it
                    compressed_gen = cherrypy.lib.encoding.compress(response, 5)
                    compressed = ""
                    for line in compressed_gen:
                        compressed += line
                    break
                    
            if compressed is not None:
                new_headers = []
                for header in self.headers:
                    if header[0].lower() != "content-length" and header[0].lower() != 'content-encoding':
                        new_headers.append( (header[0], header[1]) )

                self.headers = new_headers
                self.headers.append( ("Content-length", str(len(compressed)) ) )
                self.headers.append( ("Content-encoding", "gzip") )

                return compressed
            else:
                return response

        def my_start_response(self, new_code, new_headers):
            self.code = new_code
            self.headers = new_headers

    ssw = SecureStoreWSGI(environ, start_response)
    return [ssw.respond()]

