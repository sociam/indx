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
from indx import UNAUTH_USERNAME
from urlparse import parse_qs
from indx.reactor import IndxResponse

class IndxMapping:

    def __init__(self, indx_reactor, methods, base_path, prefix, params, handler):
        self.indx_reactor = indx_reactor
        self.methods = methods
        self.base_path = base_path
        self.prefix = prefix
        self.params = params
        self.handler = handler
        self.path = "/" + base_path + "/" + prefix

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
        force_get = self.params.get('force_get')
        tid = self.get_arg(request, 'token', force_get=force_get)

        boxid = self.get_arg(request, 'box', force_get=force_get) or self.base_path
        appid = self.get_arg(request, 'app', force_get=force_get) or "--unspecified-app--"

        def throw500(failure):
            failure.trap(Exception)
            logging.error("Failure getting new token: {0}".format(failure))
            request.callback(IndxResponse(500, "Internal Server Error"))

        if tid is None:
            logging.debug("IndxMapping request - tid is None")

            if (not self.params.get('username')) and boxid: # if you're not trying to be a user now AND you are trying to access a box
                # inject an unauthed user token here
                logging.debug("IndxMapping request get_token - injecting unauthed user token")

                origin = "/{0}".format(boxid) # check this
    
#                def got_acct(acct):
#                    logging.debug("IndxMapping request get_token got acct: {0}".format(acct))
#                    if acct == False:
#                        return self.return_forbidden(request)
#
#                    db_user, db_pass = acct
#
#                    def check_app_perms(acct):
#                        logging.debug("IndxMapping request get_token checked perms")
#                        
#                        def token_cb(token):
#                            logging.debug("IndxMapping request get_token returning injecting token: {0}".format(token))
#
#                            self.handler(request, token)
#
#                        self.indx_reactor.tokens.new(UNAUTH_USERNAME,"",boxid,appid,origin,request.getClientIP(),request.getServerID()).addCallbacks(token_cb, lambda failure: self.return_internal_error(request))
#
#                    # create a connection pool
#                    self.database.connect_box(boxid,db_user,db_pass).addCallbacks(check_app_perms, lambda conn: self.return_forbidden(request))
#
#                self.database.lookup_best_acct(request.get("box"), UNAUTH_USERNAME, "").addCallbacks(got_acct, lambda conn: self.return_forbidden(request))

                def token_cb(token):
                    logging.debug("IndxMapping request get_token returning injecting token: {0}".format(token))

                    self.handler(request, token)

                self.indx_reactor.tokens.new(UNAUTH_USERNAME,"",boxid,appid,origin,request.getClientIP(),request.getServerID()).addCallbacks(token_cb, lambda failure: throw500("Error getting Unauth user token: {0}".format(failure)))

            else:
                return self.handler(request, None)
        else:
            return self.indx_reactor.tokens.get(tid).addCallbacks(lambda token: self.handler(request, token), lambda error: throw500("IndxMapping: Error getting token for request {0}".format(error)))


    def get_post_args(self,request):
        logging.debug("get_post_args: request content {0} - {1}".format(type(request.content), request.content))

        # already decoded as JSON from the websocket
        if type(request.content) == type({}):
            return request.content

        request.content.seek(0)
        data = request.content.read()
        return parse_qs(data)


    def get_arg(self, request, argname, default = None, force_get = False):
        if request.method == 'GET' or force_get:
            return (request.args.get(argname) and request.args[argname][0]) or default

        if request.method in ['POST', 'PUT', 'DELETE', 'COPY', 'MOVE']:
            post_args = self.get_post_args(request)
            return (post_args.get(argname) and post_args[argname][0]) or default

        return default
