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

import logging, traceback, json
from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
from webbox.webserver.session import WebBoxSession, ISession
from webbox.exception import AbstractException,ResponseOverride
from mimeparse import quality
from urlparse import urlparse, parse_qs
try:
    import cjson
    logging.debug("Using CJSON.")
except Exception as e:
    logging.debug("No CJSON, falling back to python json.")

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
    
    def __init__(self, webserver, base_path=None, register=True):
        self.webserver = webserver

        if base_path is not None:
            self.base_path = base_path

        self.isLeaf = True # stops twisted from seeking children resources from me
        if register:
            logging.debug("Putting child " + self.base_path)
            webserver.root.putChild(self.base_path, self) # register path with webserver

    def _matches_request(self, request, subhandler):
        path_fields = request.path.split("/")
        sub_path = path_fields[2] if len(path_fields) >= 3 else ''

        # if the subhandler supports content negotiation, then determine the best one
        assert subhandler['accept'], 'No accept clause in subhandler %s ' % subhandler['prefix']
        
        if self._get_best_content_type_match_score(request,subhandler) <= 0:
            # logging.debug("__NOT content type match " + self._get_best_content_type_match_score(request,subhandler))            
            return False
        if not request.method in subhandler["methods"]:
            # logging.debug("__NOT in subhandler " + request.method)
            return False
        if not (subhandler["prefix"] == sub_path or subhandler["prefix"] == '*'):
            # logging.debug("__PREFIX mismatch " + sub_path + "  "  + subhandler["prefix"])            
            return False
        # logging.debug("MATCH " + sub_path )
        return True

    def _get_best_content_type_match_score(self,request,subhandler):
        request_accept = request.getHeader('Accept') or '*/*'
        return max(map(lambda handler_mimetype:quality(handler_mimetype,request_accept), subhandler["accept"]))        

    def _matches_auth_requirements(self, request, subhandler):
        session = self.get_session(request)
        if subhandler['require_auth'] and not session.is_authenticated:
            return False
        # @TODO
        # if subhandler['require_token'] and not true:
        #    raise ForbiddenResource()
        return True

    def get_token(self,request):
        if request.method == 'GET':
            try:
                tid = request.args['token'][0]
                return self.webserver.tokens.get(tid)
            except Exception as e:
                return None
        if request.method in ['POST', 'PUT']:
            try:
                logging.debug(self.get_post_args(request)['token'])
                tid = self.get_post_args(request)['token'][0]
                return self.webserver.tokens.get(tid)
            except Exception as e:
                logging.debug('exception {0}'.format(e))
                return None
        return None

    def get_origin(self,request):
        return request.getHeader('origin')
    
    def _matches_token_requirements(self, request, subhandler):
        if not subhandler['require_token']:
            return True
        token = self.get_token(request)
        boxname = self.base_path
        return token and token.verify(boxname, self.get_origin(request))
    
    def get_session(self,request):
        session = request.getSession()
        # persists for life of a session (based on the cookie set by the above)
        wbSession = session.getComponent(ISession)
        if not wbSession:
            wbSession = WebBoxSession(session)
            session.setComponent(ISession, wbSession)
        return wbSession

    def render(self, request):
        """ Twisted resource handler."""
        logging.debug("Calling base render() - " + '/'.join(request.path.split("/")) + " " + repr( self.__class__)  )
        try:
            self.set_cors_headers(request)            
            matching_handlers = filter(lambda h: self._matches_request(request,h), self.subhandlers)
            logging.debug('Matching handlers %d' % len(matching_handlers))
            matching_handlers.sort(key=lambda h: self._get_best_content_type_match_score(request,h),reverse=True)
            matching_auth_hs = filter(lambda h: self._matches_auth_requirements(request,h), matching_handlers)
            logging.debug('Post-auth matching handlers %d' % len(matching_auth_hs))
            matching_token_hs = filter(lambda h: self._matches_token_requirements(request,h), matching_auth_hs)
            logging.debug('Post-token matching handlers %d' % len(matching_token_hs))
            
            if matching_token_hs:
                subhandler = matching_token_hs[0]
                logging.debug('Using handler %s' % self.__class__.__name__ + " " + matching_token_hs[0]["prefix"])
                if subhandler['content-type']:
                    request.setHeader('Content-Type', subhandler['content-type'])
                subhandler['handler'](self,request)
                return NOT_DONE_YET
            logging.debug('Returning not found ')
            self.return_not_found(request)
            return NOT_DONE_YET
        except ResponseOverride as roe:
            self._respond(request,roe.status,roe.reason)
            return NOT_DONE_YET        
        except Exception as e:
            logging.debug("Error in AdminHandler.render(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            self.return_internal_error(request)
            return NOT_DONE_YET        
        # never get here
        pass

    def _respond(self, request, code, message, additional_data=None):
        response = {"message": message, "code": code}
        if additional_data:
            response.update(additional_data)
        try:
            responsejson = cjson.encode(response)
            logging.debug("Encoding response with cjson")
        except Exception as e:
            responsejson = json.dumps(response)
            logging.debug("Encoding response with python json")
        request.setResponseCode(code, message=message)
        request.setHeader("Content-Type", "application/json")
        request.setHeader("Content-Length", len(responsejson))
        request.write(responsejson)
        request.finish()
        logging.debug(' just called request.finish() with code %d ' % code)

    def return_ok(self,request,data=None):
        self._respond(request, 200, "OK", data)
    def return_created(self,request,data=None):
        self._respond(request, 201, "Created",data)        
    def return_not_found(self,request):
        self._respond(request, 404, "Not Found")
    def return_forbidden(self,request):
        self._respond(request, 403, "Forbidden")
    def return_unauthorized(self,request):
        self._respond(request, 401, "Unauthorized")        
    def return_unsupported_method(self,request):
        self._respond(request, 405, "Method Not Allowed")
    def return_internal_error(self,request):
        self._respond(request, 500, "Internal Server Error")
    def return_bad_request(self,request,description=None):
        self._respond(request, 400, 'Bad Request', {"description": description} if description else None)
    def return_obsolete(self,request,data=None):
        self._respond(request, 409, 'Obsolete', data)

    ## allowed for cors
    def get_cors_methods(self, request):
        # default set of allowed methods
        return ("POST", "GET", "PUT", "HEAD", "OPTIONS")
    def get_cors_origin(self, request):
        # default set of allowed origin hosts
        origin = request.getHeader("origin")
        if origin is None:
            return ()
        return (request.getHeader("origin"),) # ("*",)
    def get_cors_headers(self, request):
        # default set
        return ("Content-Type", "origin", "accept", "Depth", "User-Agent", "X-File-Size", "X-Requested-With", "Cookie", "Set-Cookie", "If-Modified-Since","X-File-Name", "Cache-Control")

    def get_post_args(self,request):
        request.content.seek(0) # dan's fault.
        return parse_qs(request.content.read())
    
    def set_cors_headers(self,request):
        if self.get_cors_origin(request):
            # logging.debug('setting allow origin {0}'.format(' '.join(self.get_cors_origin(request))))
            request.setHeader("Access-Control-Allow-Origin", ' '.join(self.get_cors_origin(request)) )
            request.setHeader("Access-Control-Allow-Methods", ', '.join( self.get_cors_methods(request)))
            request.setHeader("Access-Control-Allow-Headers", ', '.join( self.get_cors_headers(request)) )
            request.setHeader("Access-Control-Allow-Credentials", 'true')
        else:
            #logging.debug('local request - skipping cors')
            pass

