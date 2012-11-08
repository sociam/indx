#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith, Max Van Kleek
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
from twisted.web.error import UnsupportedMethod, NoResource, ForbiddenResource
from twisted.web.server import NOT_DONE_YET
from webbox.session import WebBoxSession, ISession
from webbox.exception import AbstractException
from urlparse import urlparse

class BaseHandler(Resource):
    """ Add/remove boxes, add/remove users, change config. """

    base_path=None  # Override me , e.g., 'auth'
    
    subhandlers = {
        # e.g., 
        # 'login': {
        #     'methods': ['POST'],
        #     'require_auth': False,
        #     'require_token': False,
        #     'handler': self.login,
        #     'content-type':'text/plain' # optional
        # }
    }
    
    def __init__(self, webbox, webserver):
        self.webserver = webserver
        self.webbox = webbox
        self.isLeaf = True # stops twisted from seeking children resources from me
        webserver.putChild(self.base_path, self) # register path with webserver

    def render(self, request):
        """ Twisted resource handler."""
        logging.debug("Calling AdminHandler render()")
        try:
            session = request.getSession()

            # persists for life of a session (based on the cookie set by the above)
            wbSession = session.getComponent(ISession)
            if not wbSession:
                wbSession = WebBoxSession(session)
                session.setComponent(ISession, wbSession)

            logging.debug("Is user authenticated? {0}".format(wbSession.is_authenticated))

            path_fields = split("/", request.path)
            sub_path = path_fields[1]

            subhandler = None
            if sub_path in self.subhandlers:
                subhandler = self.subhandlers[sub_path]
            elif "*" in self.subhandlers:
                subhandler = self.subhandlers["*"]

            if subhandler is not None:
                if not request.method in subhandler['methods']:
                    raise UnsupportedMethod()                
                if subhandler['require_auth'] and not wbSession.is_authenticated:
                    raise ForbiddenResource()
                if subhandler['content-type']:
                    request.setHeader('Content-Type', subhandler['content-type'])
                # @TODO
                # if subhandler['require_token'] and not true:
                #    raise ForbiddenResource()
                self.set_cors_headers(request)
                subhandler.handler(self,request)
                # done.
                return NOT_DONE_YET

            raise NoResource()        
        except Exception as e:
            logging.debug("Error in AdminHandler.render(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            request.setResponseCode(500, message="Internal Server Error")
            request.finish()
        
        return NOT_DONE_YET ## we default to asynchronous mode, which means request.write()/finish() terminates

    ## allowed for cors
    def get_cors_methods(self, request):
        # default set of allowed methods
        return ("POST", "GET", "PUT", "HEAD", "OPTIONS")
    def get_cors_origin(self, request):
        # default set of allowed origin hosts
        return ("*",)
    def get_cors_headers(self, request):
        # default set
        return ("Content-Type", "origin", "accept", "Depth", "User-Agent", "X-File-Size", "X-Requested-With", "If-Modified-Since","X-File-Name", "Cache-Control")
    
    def set_cors_headers(self,request):
        request.setHeader("Access-Control-Allow-Origin", ' '.join(self.get_cors_methods(request)) )
        request.setHeader("Access-Control-Allow-Methods", ','.join( self.get_cors_origin(request)))
        request.setHeader("Access-Control-Allow-Headers", ','.join( self.get_cors_headers(request)) )

