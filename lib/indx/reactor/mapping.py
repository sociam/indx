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
from urlparse import parse_qs

class IndxMapping:

    def __init__(self, indx_reactor, methods, path, params, handler):
        self.indx_reactor = indx_reactor
        self.methods = methods
        self.path = "/" + path
        self.params = params
        self.handler = handler

    def wildcard_match(self, a, b):
        """ 'a' can't have a wildcard, 'b' can. """
        if b[-1] == "*":
            b = b[:-1] # strip star
            if b[-1] == "/":
                b = b[:-1] # strip trailing /
            if a[-1] == "/":
                a = a[:-1] # strip trailing /
            if a[0:len(b)] == b:
                return True

            return False
        else:
            return a == b


    def matches(self, request):
        """ request is an IndxRequest """
        logging.debug("Evaluating mapping, if: {0} in {1}, {2} == {3} for {4}".format(request.method, self.methods, request.path, self.path, self.handler))
        if (request.method in self.methods) and self.wildcard_match(request.path, self.path):
            logging.debug("...Mapping matched")
            return True

        logging.debug("...Mapping did NOT match")
        return False

    def request(self, request):

        tid = self.get_arg(request, 'token', force_get = self.params.get('force_get'))
        if tid is None:
            return self.handler(request, None)

        self.indx_reactor.tokens.get(tid).addCallbacks(lambda token: self.handler(request, token), lambda error: logging.error("IndxMapping: Error getting token for request {0}".format(error)))
        

    def get_post_args(self,request):
        logging.debug("request content {0} - {1}".format(type(request.content), request.content))
        request.content.seek(0)
        return parse_qs(request.content.read())


    def get_arg(self, request, argname, default = None, force_get = False):
        if request.method == 'GET' or force_get:
            return (request.args.get(argname) and request.args[argname][0]) or default

        if request.method in ['POST', 'PUT', 'DELETE', 'COPY', 'MOVE']:
            post_args = self.get_post_args(request)
            return (post_args.get(argname) and post_args[argname][0]) or default

        return default
