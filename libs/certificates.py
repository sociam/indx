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


import logging, os, os.path, json

from webboxx509 import WebboxX509

class Certificates:

    def __init__(self, server_url, path, req_type, req_path, req_qs, environ, proxy, file_dir, config):

        self.server_url = server_url # base url of the server, e.g. http://localhost:8212
        self.path = path # the path this module is associated with, e.g. /webbox
        self.proxy = proxy # a configured SecureStoreProxy instance
        self.file_dir = os.path.realpath(file_dir) # where to store PUT files

        self.webbox_url = self.server_url + self.path # e.g. http://localhost:8212/webbox - used to ref in the RDF

        self.environ = environ # the environment (from WSGI) of the request (i.e., as in apache)
        self.req_path = req_path # the path of the request e.g. /webbox/file.rdf
        self.req_qs = req_qs # the query string of the request as a dict with array elements, e.g. {'q': ['foo']} is ?q=foo
        self.req_type = req_type # the type of query, e.g. the HTTP operation, GET/PUT/POST
        self.config = config # configuration from server

        self.certstore = WebboxX509(os.path.join(config['webbox_dir'],config['webbox']['data_dir'],config['webbox']['certstore']))

        logging.debug("new instance of certificates with path %s, query string %s and type %s" % (self.req_path, str(self.req_qs), self.req_type))

    def response(self, rfile):
        if "name" in self.req_qs and "webid" in self.req_qs:
            # call specified name and webid, so generate a certificate, store it, and return it
            name = self.req_qs['name'][0]
            webid = self.req_qs['webid'][0]
            
            details = self.certstore.generate_all(name, webid)
            return {"data": json.dumps(details), "status": 200, "type": "application/json"}

        else:
            # required vars not specified
            return {"data": "Request a certificate by specifying 'name' and 'webid'.", "status": 404}


