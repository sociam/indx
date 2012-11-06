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

import logging, json, traceback, uuid
from urlparse import urlparse, parse_qs

class OpenIDHandler:

    def __init__(self, base_url):
        self.base_url = base_url
        
    def get_back_url(self):
        return self.base_url


    def response_openid(self, environ, start_response):
        """ WSGI response handler for /openid/ ."""
        logging.debug("Calling WebBox openid response(): " + str(environ))

        try:
            req_type = environ['REQUEST_METHOD']
            rfile = environ['wsgi.input']

            if "REQUEST_URI" in environ:
                url = urlparse(environ['REQUEST_URI'])
                req_path = url.path
                req_qs = parse_qs(url.query)
            else:
                req_path = environ['PATH_INFO']
                req_qs = parse_qs(environ['QUERY_STRING'])

            headers = []
            response = ""

            if len(req_path) > 0 and req_path[0] == "/":
                req_path = req_path[1:] # strip / from start of path

            if req_type == "GET":
                # handle the /openid/ call using GET
                response_type = req_qs['response_type'][0]
                client_id = req_qs['client_id'][0]

                redirect_uri = None
                if "redirect_uri" in req_qs:
                    redirect_uri = req_qs['redirect_uri'][0]

                scope = None
                if "scope" in req_qs:
                    scope = req_qs['scope'][0]

                state = None
                if "state" in req_qs:
                    state = req_qs['state'][0]

                
            elif req_type == "POST":
                # handle the /openid/ call using POST

                size = 0
                if environ.has_key("CONTENT_LENGTH"):
                    size = int(environ['CONTENT_LENGTH'])

                body = ""
                if size > 0:
                    # read into file
                    body = rfile.read(size)

                req_qs_post = parse_qs(body)

                response_type = req_qs_post['response_type'][0]
                client_id = req_qs_post['client_id'][0]

                redirect_uri = None
                if "redirect_uri" in req_qs_post:
                    redirect_uri = req_qs_post['redirect_uri'][0]

                scope = None
                if "scope" in req_qs_post:
                    scope = req_qs_post['scope'][0]

                state = None
                if "state" in req_qs_post:
                    state = req_qs_post['state'][0]

            else:
                # When you sent 405 Method Not Allowed, you must specify which methods are allowed
                start_response("405 Method Not Allowed", [("Allow", "GET"), ("Allow", "POST"), ("Allow", "OPTIONS")])
                return [""]

            # we have response_type, client_id, redirect_uri, scope and state
            if response_type == "code":
                # Stage 1 of openid2 auth, the client is requesting a code
                # as per http://tools.ietf.org/html/draft-ietf-oauth-v2-31#section-2
                # we expire the auth code after 10 minutes and after one use.
                code = str(uuid.uuid1())



            # add CORS headers (blanket allow, for now)
            headers.append( ("Access-Control-Allow-Origin", "*") )
            headers.append( ("Access-Control-Allow-Methods", "POST, GET, HEAD, OPTIONS") )
            headers.append( ("Access-Control-Allow-Headers", "Content-Type, origin, accept, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control") )


            response = response.encode("utf8")
            headers.append( ("Content-length", len(response)) )
            start_response("200 OK", headers)
            return [response]

        except Exception as e:
            logging.debug("Error in WebBox.response_openid(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            start_response("500 Internal Server Error", [])
            return [""]

