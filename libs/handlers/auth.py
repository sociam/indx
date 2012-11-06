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
from session import WebBoxSession, ISession

class AuthHandler(Resource):
    """ User login/logout, cookies and tokens. """

    def __init__(self):
        self.isLeaf = True # stops twisted from seeking children resources from me

    def render(self, request):
        """ Twisted resource handler. """

        logging.debug("Calling AuthHandler render()")
        try:
            session = request.getSession()

            # persists for life of a session (based on the cookie set by the above)
            wbSession = session.getComponent(ISession)
            if not wbSession:
                wbSession = WebBoxSession(session)
                session.setComponent(ISession, wbSession)

            logging.debug("Is user authenticated? {0}".format(wbSession.is_authenticated))

            # common HTTP methods
            if request.method == "GET":
                response = self.do_GET(request)
            elif request.method == "POST":
                response = self.do_POST(request)
            elif request.method == "OPTIONS":
                response = {"status": 200, "reason": "OK", "data": "", "headers": self.get_supported_method_headers() }

            # Another unsupported method
            else:
                # When you sent 405 Method Not Allowed, you must specify which methods are allowed
                response = {"status": 405, "reason": "Method Not Allowed", "data": "", "headers": self.get_supported_method_headers() }

            # get headers from response if they exist
            headers = []
            if "headers" in response:
                headers = response['headers']

            headers.append( ("Content-type", "text/plain") )
            headers.append( ("Access-Control-Allow-Origin", "*") )
            headers.append( ("Access-Control-Allow-Methods", "POST, GET, PUT, HEAD, OPTIONS") )
            headers.append( ("Access-Control-Allow-Headers", "Content-Type, origin, accept, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control") )
            headers.append( ("Content-length", len(response['data'])) )

            # start sending the response
            request.setResponseCode(response['status'], message=response['reason'])
            for header in headers:
                (header_name, header_value) = header
                request.setHeader(header_name, header_value)

            if type(response['data']) is unicode:
                logging.debug("Returning unicode")
                return response['data'].encode('utf8')
            else:
                logging.debug("Returning a string")
                return response['data']

        except Exception as e:
            logging.debug("Error in AuthHandler.render(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            request.setResponseCode(500, message="Internal Server Error")
            return ""
        
    def do_POST(self, request):
        # login called
        if request.path == "/auth/login":
            logging.debug("Login request")
            return self.auth_login(request)

        # logout called
        if request.path == "/auth/logout":
            logging.debug("Logout request")
            return self.auth_logout(request)

        return {"data": "", "status": 404, "reason": "Not Found"}

    def do_GET(self, request):
        # logout called
        if request.path == "/auth/logout":
            logging.debug("Logout request")
            return self.auth_logout(request)

        return {"data": "", "status": 404, "reason": "Not Found"}

    # authentication
    def auth_login(self, request):
        """ User logged in (POST) """
        logging.debug("Login request, origin: {0}".format(request.getHeader("Origin")))

        session = request.getSession()
        wbSession = session.getComponent(ISession)
        wbSession.setAuthenticated(True)
        wbSession.setUser(0, "anonymous")

        return {"data": "", "status": 200, "reason": "OK"}

    def auth_logout(self, request):
        """ User logged out (GET, POST) """
        logging.debug("Logout request, origin: {0}".format(request.getHeader("Origin")))

        session = request.getSession()
        wbSession = session.getComponent(ISession)
        wbSession.setAuthenticated(False)
        wbSession.setUser(None, None)

        return {"data": "", "status": 200, "reason": "OK"}



