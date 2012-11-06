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

import logging, json, traceback
from urlparse import urlparse, parse_qs

class LRDDHandler:

    def __init__(self, base_url):
        self.base_url = base_url
        
    def get_back_url(self):
        return self.base_url

    def response_lrdd(self, environ, start_response):
        """ WSGI response handler for /lrdd/ ."""
        logging.debug("Calling WebBox lrdd response(): " + str(environ))

        try:
            req_type = environ['REQUEST_METHOD']

            if "REQUEST_URI" in environ:
                url = urlparse(environ['REQUEST_URI'])
                req_path = url.path
                req_qs = parse_qs(url.query)
            else:
                req_path = environ['PATH_INFO']
                req_qs = parse_qs(environ['QUERY_STRING'])

            headers = []
            response = ""

            if req_type == "GET":
                # handle the /lrdd/ call

                if len(req_path) > 0 and req_path[0] == "/":
                    req_path = req_path[1:] # strip / from start of path

                
                if "uri" in req_qs:
                    lrdd_uri = req_qs['uri'][0]


                accept = environ['HTTP_ACCEPT'].lower()
                if "json" in accept: # FIXME do proper content negotiation

                    # response with json (JRD)

                    headers.append( ("Content-Type", "application/json; charset=UTF-8") )

                    response_json = {"subject": lrdd_uri, "links": [
                        { "rel": "http://specs.openid.net/auth/2.0/provider",
                          "href": "%s/openid" % (self.get_base_url()),
                        }
                    ]}
                    response = json.dumps(response_json, indent=2)


                if response == "":
                    # respond with XML
                    headers.append( ("Content-Type", "application/xrd+xml; charset=UTF-8") )

                    response = """<?xml version='1.0' encoding='UTF-8'?>
<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0' 
     xmlns:hm='http://host-meta.net/xrd/1.0'>

  <Subject>%s</Subject>
  <Link rel='http://specs.openid.net/auth/2.0/provider' 
        href='%s/openid'>
  </Link>
</XRD>
""" % (lrdd_uri, self.get_base_url())


            else:
                # When you sent 405 Method Not Allowed, you must specify which methods are allowed
                start_response("405 Method Not Allowed", [("Allow", "GET"), ("Allow", "OPTIONS")])
                return [""]

            # add CORS headers (blanket allow, for now)
            headers.append( ("Access-Control-Allow-Origin", "*") )
            headers.append( ("Access-Control-Allow-Methods", "POST, GET, HEAD, OPTIONS") )
            headers.append( ("Access-Control-Allow-Headers", "Content-Type, origin, accept, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control") )

            response = response.encode("utf8")
            headers.append( ("Content-length", len(response)) )
            start_response("200 OK", headers)
            return [response]

        except Exception as e:
            logging.debug("Error in WebBox.response_lrdd(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            start_response("500 Internal Server Error", [])
            return [""]


