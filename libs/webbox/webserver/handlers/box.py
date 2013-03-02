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

import logging, json
from webbox.webserver.handlers.base import BaseHandler
from webbox.objectstore_async import IncorrectPreviousVersionException

class BoxHandler(BaseHandler):
    base_path = ''

    def options(self, request):
        self.return_ok(request)

    def diff(self, request):
        """ Return the objects (or ids of objects) that have changes between two versions of the objectstore.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        try:
            from_version = request.args['from_version'][0]
            to_version = request.args['to_version'][0]
        except Exception as e:
            logging.error("Exception in box.diff getting argument: {0}".format(e))
            return self.return_bad_request(request, "Specify the following arguments in query string: from_version, to_version.")

        # return IDs of changed object, or return full objects
        return_objs = False
        if "return_objs" in request.args:
            return_objs = True

        try:
            logging.debug("calling diff on store")
            token.store.diff(from_version, to_version, return_objs).addCallback(lambda results: self.return_ok(request, results))
        except Exception as e:
            return self.return_internal_error(request)


    def get_object_ids(self, request):
        """ Get a list of object IDs in this box.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        try:
            logging.debug("calling get_object_ids on store")
            token.store.get_object_ids().addCallback(lambda results: self.return_ok(request, results))
        except Exception as e:
            return self.return_internal_error(request)

    def query(self, request):
        """ Perform a query against the box, and return matching objects.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        try:
            q = json.loads(request.args['q'][0])
        except Exception as e:
            logging.error("Exception in box.query getting 'q': {0}".format(e))
            return self.return_bad_request(request, "Specify query as query string parameter 'q' as valid JSON")

        try:
            logging.debug("querying store with q: "+str(q))

            def handle_add_error(failure):
                """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
                failure.trap(Exception)
                #err = failure.value
                logging.debug("Exception trying to add to query.")
                return self.return_internal_error(request)

            token.store.query(q).addCallbacks(lambda results: self.return_ok(request, {"data": results}), # callback
                    handle_add_error) # errback
        except Exception as e:
            logging.error("Exception in box.query: {0}".format(e))
            return self.return_internal_error(request)


    def do_GET(self,request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store

        def handle_error(failure):
            """ Handle an error on get (this is the errback). """ #TODO move this somewhere else?
            failure.trap(Exception)
            #err = failure.value
            logging.debug("Exception trying to get latest.")
            return self.return_internal_error(request)

        return store.get_latest().addCallbacks(lambda obj: self.return_ok(request, {"data": obj}),
                handle_error)
   

    def do_PUT(self,request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        store, args = token.store, self.get_post_args(request)

        if "version" not in args:
            return self.return_bad_request(request,"Specify a previous version with &version=")
        prev_version = int(args['version'][0])

        objs = json.loads(args['data'][0])

        if type(objs) != type([]):
            objs = [objs]
            
        d = store.update(objs, prev_version)

        def handle_add_error(failure):
            """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
            failure.trap(IncorrectPreviousVersionException, Exception)
            err = failure.value
            if isinstance(err, IncorrectPreviousVersionException):
                logging.debug("Incorrect previous version")
                actual_version = err.version
                return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
            else:
                logging.debug("Exception trying to add to store.")
                return self.return_internal_error(request)

        d.addCallbacks(lambda new_version_info: self.return_created(request,{"data":new_version_info}), # callback
            handle_add_error) #errback
        return


    def do_DELETE(self,request):
        """ Handle DELETE calls. Requires a JSON array of object IDs in the body as the 'data' argument:
            e.g.,

            ['obj_123','obj_456']

            and the current box version as the 'version' argument. If the version is incorrect, a 409 Obsolete is returned.

            request -- The twisted request object
        """

        # get validated token
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        store, args = token.store, self.get_post_args(request)

        if "version" not in args:
            return self.return_bad_request(request,"Specify a previous version in the body with &version=")
        prev_version = int(args['version'][0])

        id_list = json.loads(args['data'][0])

        if type(id_list) != type([]):
            id_list = [id_list]

        d = store.delete(id_list, prev_version)

        def handle_add_error(failure):
            """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
            failure.trap(IncorrectPreviousVersionException, Exception)
            err = failure.value
            if isinstance(err, IncorrectPreviousVersionException):
                logging.debug("Incorrect previous version")
                actual_version = err.version
                return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
            else:
                logging.debug("Exception trying to add to store.")
                return self.return_internal_error(request)

        d.addCallbacks(lambda new_version_info: self.return_created(request,{"data":new_version_info}), # callback
            handle_add_error) #errback
        return

BoxHandler.subhandlers = [
    {
        "prefix": "get_object_ids",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.get_object_ids,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "diff",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.diff,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "query",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.query,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        # get_latest
        "prefix": "*",            
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.do_GET,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        # update
        "prefix": "*",            
        'methods': ['PUT'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.do_PUT,
        'accept':['application/json'],
        'content-type':'application/json'        
        },
    {
        "prefix": "*",       
        'methods': ['DELETE'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.do_DELETE,
        'accept':['application/json'],
        'content-type':'application/json'        
        },
    {
        'prefix':'*',
        'methods': ['OPTIONS'],
        'require_auth': False,
        'require_token': False,
        'handler': BaseHandler.return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        }
]

        
