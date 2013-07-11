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

import logging, json, traceback, uuid
from urlparse import urlparse, parse_qs
from webbox.webserver.handlers.base import BaseHandler

class OpenIDHandler(BaseHandler):

    base_path = 'openid'
    subhandlers = {
        '': {
            'methods': ['GET', 'POST'],
            'require_auth': False,
            'require_token': False,
            'handler': OpenIDHandler.openid,
        },
    }

    def openid(self, request):
        """ Response handler for /openid/ ."""

        client_id = request.args['client_id'][0]

        response_type = request.args['response_type'][0]

        redirect_uri = None
        if "redirect_uri" in request.args:
            redirect_uri = request.args['redirect_uri'][0]

        scope = None
        if "scope" in request.args:
            scope = request.args['scope'][0]

        state = None
        if "state" in request.args:
            state = request.args['state'][0]

        body = request.content.read()

        # we have response_type, client_id, redirect_uri, scope and state
        if response_type == "code":
            # Stage 1 of openid2 auth, the client is requesting a code
            # as per http://tools.ietf.org/html/draft-ietf-oauth-v2-31#section-2
            # we expire the auth code after 10 minutes and after one use.
            code = str(uuid.uuid1())

        # TODO finish this implementation

        request.finish()

