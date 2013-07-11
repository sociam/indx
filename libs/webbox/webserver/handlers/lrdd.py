#    This file is part of INDX.
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

import logging, json, traceback
from webbox.webserver.handlers.base import BaseHandler
from urlparse import urlparse, parse_qs

class LRDDHandler(BaseHandler):

    base_path = 'lrdd'
    subhandlers = {
        '': {
            'methods': ['GET'],
            'require_auth': False,
            'require_token': False,
            'handler': LRDDHandler.lrdd,
        },
    }

    def lrdd(self, request):
        """ Response handler for /lrdd/ """

        # handle the /lrdd/ call
        if "uri" in request.args:
            lrdd_uri = request.args['uri'][0]

        accept = reqeust.getHeader("Accept")
        if "json" in accept: # FIXME do proper content negotiation

            # response with json (JRD)
            request.setHeader("Content-Type", "application/json; charset=UTF-8")

            response_json = {"subject": lrdd_uri, "links": [
                { "rel": "http://specs.openid.net/auth/2.0/provider",
                  "href": "/openid",
                }
            ]}
            response = json.dumps(response_json, indent=2)
            request.write(response)
            request.finish()

        else:
        
            # respond with XML
            request.setHeader("Content-Type", "application/xrd+xml; charset=UTF-8")

            response = """<?xml version='1.0' encoding='UTF-8'?>
<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0' 
     xmlns:hm='http://host-meta.net/xrd/1.0'>

  <Subject>%s</Subject>
  <Link rel='http://specs.openid.net/auth/2.0/provider' 
        href='/openid'>
  </Link>
</XRD>
""" % (lrdd_uri)
            request.write(response)
            request.finish()

