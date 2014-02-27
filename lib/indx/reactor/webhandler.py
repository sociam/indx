#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
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
import json
import traceback
from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
from indx.reactor import IndxRequest

class IndxWebHandler(Resource):
    """ Acts as a handler for the web server, and passes off requests to the IndxReactor. """

    def __init__(self, indx_reactor):
        Resource.__init__(self)
        self.indx_reactor = indx_reactor
        self.isLeaf = True

    def render(self, request):

        method = request.method
        path = request.path
        params = {
            "headers": request.headers,
            "args": request.args,
        }

        logging.debug("IndxWebHandler, request, path: {0}".format(path))

        def callback(indx_response):

            try:
                response = {"message": indx_response.message, "code": indx_response.code}
                response.update(indx_response.data)
                responsejson = json.dumps(response)

                if not request._disconnected:
                    request.setResponseCode(indx_response.code, indx_response.message)
                    request.setHeader("Content-Type", "application/json")
                    request.setHeader("Content-Length", len(responsejson))
                    request.write(responsejson)
                    request.finish()
                    logging.debug(' just called request.finish() with code %d ' % indx_response.code)
                else:
                    logging.debug(' didnt call request.finish(), because it was already disconnected')
            except Exception as e:
                logging.debug("IndxWebHandler error sending response: {0},\ntrace: {1}".format(e, traceback.format_exc()))

        indx_request = IndxRequest(method, path, params, request.getSession().uid, callback)
        self.indx_reactor.incoming(indx_request)
        return NOT_DONE_YET

