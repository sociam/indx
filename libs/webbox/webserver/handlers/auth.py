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

import logging, traceback
from twisted.web.resource import Resource
from webbox.webserver.session import WebBoxSession, ISession
from webbox.webserver.handlers.base import BaseHandler

class AuthHandler(BaseHandler):
    base_path = 'auth'
    # authentication
    def auth_login(self, request):
        """ User logged in (POST) """
        logging.debug("Login request, origin: {0}".format(request.getHeader("Origin")))
        wbSession = self.get_session(request)
        wbSession.setAuthenticated(True)
        wbSession.setUser(0, "anonymous")
        self.return_ok(request)

    def auth_logout(self, request):
        """ User logged out (GET, POST) """
        logging.debug("Logout request, origin: {0}".format(request.getHeader("Origin")))
        wbSession = self.get_session(request)
        wbSession.setAuthenticated(False)
        wbSession.setUser(None, None)
        self.return_ok(request)

AuthHandler.subhandlers = [
    {
        'prefix':'login',
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.auth_login,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
    {
        'prefix':'logout',
        'methods': ['POST', 'GET'],
        'require_auth': True,
        'require_token': False,
        'handler': AuthHandler.auth_logout,
        'content-type':'text/plain', # optional
        'accept':['application/json']        
        },
    {
        'prefix':'logout',
        'methods': ['POST', 'GET'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.return_ok, # already logged out
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        }        
]

