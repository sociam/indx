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
import urlparse
from indx.webserver.handlers.base import BaseHandler
from openid.store import memstore
#from openid.store import filestore
from openid.consumer import consumer
from openid.oidutil import appendArgs
#from openid.cryptutil import randomString
#from openid.fetchers import setDefaultFetcher, Urllib2Fetcher
from openid.extensions import pape, sreg

OPENID_PROVIDER_NAME = "INDX OpenID Handler"
OPENID_PROVIDER_URL = "http://indx.ecs.soton.ac.uk/"

""" Start a login with OpenID like:

    # for a google plus account
    http://localhost:8211/openid/verify?identity=https://plus.google.com/114976418317566143717

    # for an INDX ID account
    http://localhost:8211/openid/verify?identity=http://id.indx.ecs.soton.ac.uk/identity/ds

    """

class OpenIDHandler(BaseHandler):
    base_path = 'openid'
    store = memstore.MemoryStore()

    def verify(self, request):
        """ Verify an OpenID identity. """
        try:
            identity = request.args['identity'][0]
            logging.debug("OpenID, verify, identity: {0}".format(identity))
        except Exception as e:
            logging.debug("OpenID, verify, exception: {0}".format(e))
            return self.return_bad_request(request, "You must specify an 'identity' in the GET query parameters.")

        oid_consumer = consumer.Consumer(self.get_openid_session(request), self.store)
        try:
            oid_req = oid_consumer.begin(identity)
        except consumer.DiscoveryFailure, exc:
            # FIXME handle this much better
            request.setResponseCode(200, message = "OK")
            request.write("Error: {0}".format(exc))
            request.finish()
        else:
            if oid_req is None:
                # FIXME handle this much better
                request.setResponseCode(200, message = "OK")
                request.write("Error, no OpenID services found for: {0}".format(identity))
                request.finish()
            else:
                trust_root = self.webserver.server_url
                return_to = appendArgs(trust_root + "/openid/process", {})

                logging.debug("OpenID, had oid_req, trust_root: {0}, return_to: {1}, oid_req: {2}".format(trust_root, return_to, oid_req))

                redirect_url = oid_req.redirectURL(trust_root, return_to)
                # FIXME check this is the best way to redirect here
                request.setHeader("Location", redirect_url)
                request.setResponseCode(302, "Found")
                request.finish()

    def process(self, request):
        """ Process a callback from an identity provider. """
        oid_consumer = consumer.Consumer(self.get_openid_session(request), self.store)
        query = urlparse.parse_qsl(urlparse.urlparse(request.uri).query)
        queries = {}
        for key, val in query:
            queries[key] = val
        logging.debug("Queries: {0}".format(queries))
        info = oid_consumer.complete(queries, self.webserver.server_url + "/openid/process")

        display_identifier = info.getDisplayIdentifier()

        if info.status == consumer.FAILURE and display_identifier:
            request.setResponseCode(200, "OK")
            request.write("Verification of {0} failed: {1}".format(display_identifier, info.message))
            request.finish()
        elif info.status == consumer.SUCCESS:
            sreg_resp = sreg.SRegResponse.fromSuccessResponse(info)
            pape_resp = pape.Response.fromSuccessResponse(info)

            request.setResponseCode(200, "OK")
            request.write("Success of {0}, sreg_resp: {1}, pape_resp: {2}".format(display_identifier, sreg_resp, pape_resp))
            if info.endpoint.canonicalID:
                request.write("...This is an i-name and its persistent ID is: {0}".format(info.endpoint.canonicalID))
            request.finish()
        elif info.status == consumer.CANCEL:
            request.setResponseCode(200, "OK")
            request.write("Verification cancelled.")
            request.finish()
        elif info.status == consumer.SETUP_NEEDED:
            request.setResponseCode(200, "OK")
            request.write("Setup needed at URL: {0}".format(info.setup_url))
            request.finish()
        else:
            request.setResponseCode(200, "OK")
            request.write("Veritication Failed.")
            request.finish()


    def get_openid_session(self, request):
        return self.get_session(request).get_openid_session()


OpenIDHandler.subhandlers = [
    {
        'prefix':'process',
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': OpenIDHandler.process,
        'content-type':'text/plain', # optional
        'accept':['application/json']      
    },    
    {
        'prefix':'verify',
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': OpenIDHandler.verify,
        'content-type':'text/plain', # optional
        'accept':['application/json']      
    }    
]


