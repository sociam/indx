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

import logging, json
from indx.webserver.handlers.base import BaseHandler
from twisted.web.server import NOT_DONE_YET
import requests

class MovesApp(BaseHandler):
    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = True

    def render(self, request):
        logging.debug("Moves App, request args: {0}".format(request.args))
        # forwards a POST request (same domain, because of XHR cross-domain security), then through moves.indx.ecs.soton.ac.uk (which holds the client secret ID) to the API at moves-app.com (phew!)
        if "code" in request.args:
            code = request.args['code'][0]
            response = requests.post("http://moves.indx.ecs.soton.ac.uk/get_token/", data = {"code": code})
            logging.debug("Moves App, returning response from server")
            self.return_ok(request, data = {"response": json.loads(response.text)})
        else:
            logging.debug("Moves App, returning 404")
            self.return_not_found(request)
        return NOT_DONE_YET

APP = MovesApp
