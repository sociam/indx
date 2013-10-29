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
from indx.objectstore_async import IncorrectPreviousVersionException, FileNotFoundException
from indx.user import IndxUser

class BoxHandler(BaseHandler):
    base_path = ''

    @staticmethod
    def log(level, message, extra = {}):
        """ Send a log message that contains a reference to the request, token and message. """
        if 'request' not in extra or extra['request'] is None:
            request_id = "NoReqID"
        else:
            request_id = id(extra['request'])
        if 'token' not in extra or extra['token'] is None:
            token_id = "NoTokenID"
        else:
            token_id = extra['token'].id
        logger = logging.getLogger("CONN")
        logger.log(level, 'REQ:%s\tTOKEN:%s\t%s', request_id, token_id, message)

    @staticmethod
    def error(message, extra = {}):
        BoxHandler.log(logging.ERROR, message, extra)

    @staticmethod
    def debug(message, extra = {}):
        BoxHandler.log(logging.DEBUG, message, extra)


    def options(self, request):
        BoxHandler.log(logging.DEBUG, "BoxHandler OPTIONS request.", extra = {"request": request})
        self.return_ok(request)


    def diff(self, request):
        """ Return the objects (or ids of objects) that have changes between two versions of the objectstore.
        """
        token = self.get_token(request)
        if not token:
            BoxHandler.log(logging.DEBUG, "BoxHandler diff request (token not valid), args are: {0}".format(request.args), extra = {"request": request})
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler diff err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler diff request, args are: {0}".format(request.args), extra = {"request": request, "token": token})

            from_version = self.get_arg(request, "from_version")
            if from_version is None:
                BoxHandler.log(logging.ERROR, "Exception in box.diff getting argument from_version: {0}".format(from_version), extra = {"request": request, "token": token})
                return self.return_bad_request(request, "Specify the following arguments in query string: from_version.")
 
            try:
                from_version = int(from_version)
            except Exception as ee:
                BoxHandler.log(logging.DEBUG, "Exception in box.diff converting from_version ({0}) to an int ({1}).".format(from_version, ee))
                return self.return_bad_request(request, "from_version must be an integer.")

            return_objs = self.get_arg(request, "return_objs")
            valid_return_objs = ['objects', 'ids', 'diff']
            if return_objs not in valid_return_objs:
                BoxHandler.log(logging.ERROR, "Exception in box.diff, argument return_objs not valid: {0}, must be one of: {1}".format(return_objs, valid_return_objs), extra = {"request": request, "token": token})
                return self.return_bad_request(request, "Invalid version for 'return_objs', valid values are: {0}.".format(valid_return_objs)) # TODO genericise this as above


            # to_version is optional, if unspecified, the latest version is used.
            # to_version = None is acceptable
            to_version = self.get_arg(request, "to_version")
            if "to_version" is not None:
                try:
                    to_version = int(to_version)
                except Exception as ee:
                    BoxHandler.log(logging.DEBUG, "Exception in box.diff converting to_version ({0}) to an int ({1}).".format(to_version, ee))
                    return self.return_bad_request(request, "when specified, to_version must be an integer.")

            try:
                BoxHandler.log(logging.DEBUG, "BoxHandler calling diff on store", extra = {"request": request, "token": token})

                def handle_add_error(failure):
                    failure.trap(Exception)
                    #err = failure.value
                    BoxHandler.log(logging.DEBUG, "Exception trying to diff: {0}".format(failure.value), extra = {"request": request, "token": token})
                    return self.return_internal_error(request)

                store.diff(from_version, to_version, return_objs).addCallbacks(lambda results: self.return_ok(request, results), handle_add_error)
            except Exception as e:
                BoxHandler.log(logging.ERROR, "BoxHandler error calling diff on store: {0}".format(e), extra = {"request": request, "token": token})
                return self.return_internal_error(request)

        token.get_store().addCallbacks(store_cb, err_cb)

    def set_acl(self, request):
        """ Set an ACL for this box.

            RULES (these are in box.py and in user.py)
            The logged in user sets an ACL for a different, target user.
            The logged in user must have a token, and the box of the token is the box that will have the ACL changed/set.
            If there is already an ACL for the target user, it will be replaced.
            The logged in user must have "control" permissions on the box.
            The logged in user can give/take read, write or control permissions. They cannot change "owner" permissions.
            If the user has owner permissions, it doesn't matter if they dont have "control" permissions, they can change anything.
            Only the user that created the box has owner permissions.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler set_acl", extra = {"request": request, "token": token})

        wbSession = self.get_session(request)
        user = IndxUser(self.database, wbSession.username)

        # box is set by the token (token.boxid)
        try:
            req_acl = json.loads(self.get_arg(request, "acl"))
        except Exception as e:
            BoxHandler.log(logging.ERROR, "Exception in box.set_acl decoding JSON in query, 'acl': {0}".format(e), extra = {"request": request, "token": token})
            return self.return_bad_request(request, "Specify acl as query string parameter 'acl' as valid JSON")

        req_username = self.get_arg(request, "target_username") # username of the user of which to change the ACL

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler set_acl err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        user.set_acl(token.boxid, req_username, req_acl).addCallbacks(lambda empty: self.return_ok(request), err_cb)


    def get_object_ids(self, request):
        """ Get a list of object IDs in this box.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler get_object_ids", extra = {"request": request, "token": token})

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler get_object_ids err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "calling get_object_ids on store", extra = {"request": request, "token": token})
            store.get_object_ids().addCallbacks(lambda results: self.return_ok(request, results), err_cb)

        token.get_store().addCallbacks(store_cb, err_cb)


    def query(self, request):
        """ Perform a query against the box, and return matching objects.
        """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler query err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler query request, args: {0}".format(request.args), extra = {"request": request, "token": token})

            try:
                q = json.loads(self.get_arg(request, "q"))
            except Exception as e:
                BoxHandler.log(logging.ERROR, "Exception in box.query decoding JSON in query, 'q': {0}".format(e), extra = {"request": request, "token": token})
                return self.return_bad_request(request, "Specify query as query string parameter 'q' as valid JSON")


            predicate_list = None
            try:
                predicate_list = request.args['predicate_list[]']
                BoxHandler.log(logging.DEBUG, "BoxHandler query, predicate_list {0}".format(repr(predicate_list)), extra = {"request": request, "token": token})
            except Exception as e:
                BoxHandler.log(logging.DEBUG, "BoxHandler query, no predicate_list", extra = {"request": request, "token": token})


            try:
                BoxHandler.log(logging.DEBUG, "BoxHandler querying store with q: "+str(q), extra = {"request": request, "token": token})

                def handle_add_error(failure):
                    """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
                    failure.trap(Exception)
                    #err = failure.value
                    BoxHandler.log(logging.DEBUG, "BoxHandler Exception trying to add to query.", extra = {"request": request, "token": token})
                    return self.return_internal_error(request)

                store.query(q, predicate_filter = predicate_list).addCallbacks(lambda results: self.return_ok(request, {"data": results}), # callback
                        handle_add_error) # errback
            except Exception as e:
                BoxHandler.log(logging.ERROR, "Exception in box.query: {0}".format(e), extra = {"request": request, "token": token})
                return self.return_internal_error(request)

        token.get_store().addCallbacks(store_cb, err_cb)


    
    def files(self, request):
        """ Handler for queries like /box/files?id=notes.txt&version=2

            Handles GET, PUT and DELETE of files.
            Sending current version in the request is required as in the JSON requests.

            request -- Twisted request object.
        """
        token = self.get_token(request, force_get=True)
        if not token:
            return self.return_forbidden(request)

        BoxHandler.log(logging.DEBUG, "BoxHandler files", extra = {"request": request, "token": token})

        def err_cb(failure):
#            failure.trap(Exception)
            e = failure.value
            if isinstance(e, IncorrectPreviousVersionException):
                BoxHandler.log(logging.DEBUG, "BoxHandler files, err_cb, Incorrect previous version", extra = {"request": request, "token": token})
                actual_version = e.version
                return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
            elif isinstance(e, FileNotFoundException):
                BoxHandler.log(logging.DEBUG, "BoxHandler files, err_cb, File not found", extra = {"request": request, "token": token})
                return self.return_not_found(request)
            else:
                BoxHandler.log(logging.ERROR, "BoxHandler files err_cb: {0}".format(failure), extra = {"request": request, "token": token})
                return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler files request", extra = {"request": request, "token": token})

            file_id = self.get_arg(request, "id")

            if file_id is None:
                # list files

                def file_list_cb(files):
                    BoxHandler.log(logging.DEBUG, "BoxHandler files file_list_cb, files = {0}".format(files), extra = {"request": request, "token": token})
                    self.return_ok(request, files)

                store.list_files().addCallbacks(file_list_cb, err_cb)
                return
            
            if request.method == 'GET':
                BoxHandler.log(logging.DEBUG, "BoxHandler files GET request", extra = {"request": request, "token": token})

                def file_cb(info):
                    file_data, contenttype = info
                    BoxHandler.log(logging.DEBUG, "BoxHandler files file_db, contenttype: {0}".format(contenttype), extra = {"request": request, "token": token})
                    return self.return_ok_file(request, file_data, contenttype)

                store.get_latest_file(file_id).addCallbacks(file_cb, err_cb)
            elif request.method == 'PUT':
                BoxHandler.log(logging.DEBUG, "BoxHandler files POST request", extra = {"request": request, "token": token})

                version = self.get_arg(request, "version")
                if version is None:
                    BoxHandler.log(logging.DEBUG, "BoxHandler files: no 'version' argument in URL: {0}".format(e), extra = {"request": request, "token": token})
                    return self.return_bad_request(request, "You must specify the 'version' argument for the box.")

                try:
                    request.content.seek(0)
                    new_files = [ (file_id, request.content.read(), request.getHeader("Content-Type")) ]

                    store.update_files(version, new_files).addCallbacks(lambda obj: self.return_ok(request, {"data": obj}), err_cb)
                except Exception as e:
                    if isinstance(e, IncorrectPreviousVersionException):
                        BoxHandler.log(logging.DEBUG, "Incorrect previous version", extra = {"request": request, "token": token})
                        actual_version = e.version
                        return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
                    else:
                        BoxHandler.log(logging.ERROR, "Exception trying to PUT {0}".format(e), extra = {"request": request, "token": token})
                        return self.return_internal_error(request);

            elif request.method == 'DELETE':
                BoxHandler.log(logging.DEBUG, "BoxHandler files DELETE request", extra = {"request": request, "token": token})

                version = self.get_arg(request, "version")
                if version is None:
                    BoxHandler.log(logging.DEBUG, "BoxHandler files: no 'version' argument in URL: {0}".format(e), extra = {"request": request, "token": token})
                    return self.return_bad_request(request, "You must specify the 'version' argument for the box.")

                try:
                    # new version, with delete_files_ids as the effect we want to change
                    store.update_files(version, new_files=[], delete_files_ids=[file_id]).addCallbacks(lambda obj: self.return_ok(request, {"data": obj}), err_cb)
                except Exception as e:
                    if isinstance(e, IncorrectPreviousVersionException):
                        BoxHandler.log(logging.DEBUG, "Incorrect previous version", extra = {"request": request, "token": token})
                        actual_version = e.version
                        return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
                    else:
                        BoxHandler.log(logging.ERROR, "Exception trying to DELETE {0} ".format(e), extra = {"request": request, "token": token})
                        return self.return_internal_error(request);
            else:
                BoxHandler.log(logging.DEBUG, "BoxHandler files UNKNOWN request", extra = {"request": request, "token": token})
                pass #FIXME finish
                return self.return_bad_request(request)

        token.get_store().addCallbacks(store_cb, err_cb)


    def do_GET(self,request):
        BoxHandler.log(logging.DEBUG, "BoxHandler do_GET >>>>>>>>>>>>>>>>>>>>")

        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler do_GET err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler GET request", extra = {"request": request, "token": token})

            
            id_list = request.args.get("id") or request.args.get("id[]") # don't use self.get_arg() because we need a list, not just [0]
            if id_list is not None:
                # return the objects listed in in the id arguments, e.g.:
                    # GET /box/?id=item1&id=item2&id=item3
                BoxHandler.log(logging.DEBUG, "BoxHandler GET request", extra = {"request": request, "id": request.args.get('id'), "id[]": request.args.get('id[]')})
                # return ids of the whole box
                return store.get_latest_objs(id_list).addCallbacks(lambda obj: self.return_ok(request, {"data": obj}), err_cb)
            else:
                BoxHandler.log(logging.DEBUG, "BoxHandler GET request no id {0}".format(request))
                # return the whole box
                return store.get_latest().addCallbacks(lambda obj: self.return_ok(request, {"data": obj}), err_cb)

        token.get_store().addCallbacks(store_cb, err_cb)
   

    def do_PUT(self,request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler do_PUT err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler PUT request", extra = {"request": request, "token": token})

            prev_version = self.get_arg(request, "version")
            if prev_version is not None:
                try:
                    prev_version = int(prev_version)
                except Exception as e:
                    BoxHandler.log(logging.DEBUG, "Exception in do_PUT converting version (prev_version) ({0}) to an int ({1}).".format(prev_version, e))
                    return self.return_bad_request(request, "version must be an integer.")
            else:
                return self.return_bad_request(request,"Specify a previous version with &version=")

            objs = json.loads(self.get_arg(request, "data"))

            if type(objs) != type([]):
                objs = [objs]
                
            d = store.update(objs, prev_version)

            def handle_add_error(failure):
                """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
                BoxHandler.error("BoxHandler do_PUT handle_add_error: {0}".format(failure), extra = {"request": request, "token": token})
                failure.trap(IncorrectPreviousVersionException, Exception)
                err = failure.value
                if isinstance(err, IncorrectPreviousVersionException):
                    BoxHandler.log(logging.DEBUG, "Incorrect previous version", extra = {"request": request, "token": token})
                    actual_version = err.version
                    return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
                else:
                    BoxHandler.log(logging.ERROR, "Exception trying to add to store: {0}".format(err), extra = {"request": request, "token": token})
                    return self.return_internal_error(request)

            d.addCallbacks(lambda new_version_info: self.return_created(request,{"data":new_version_info}), # callback
                handle_add_error) #errback

        token.get_store().addCallbacks(store_cb, err_cb)


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

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler do_DELETE err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})

            BoxHandler.log(logging.DEBUG, "BoxHandler DELETE request", extra = {"request": request, "token": token})

            prev_version = self.get_arg(request, "version")
            if prev_version is not None:
                try:
                    prev_version = int(prev_version)
                except Exception as e:
                    BoxHandler.log(logging.DEBUG, "Exception in do_PUT converting version (prev_version) ({0}) to an int ({1}).".format(prev_version, e))
                    return self.return_bad_request(request, "version must be an integer.")
            else:
                return self.return_bad_request(request,"Specify a previous version with &version=")

            id_list = json.loads(self.get_arg(request, "data"))

            if type(id_list) != type([]):
                id_list = [id_list]

            d = store.delete(id_list, prev_version)

            def handle_add_error(failure):
                """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
                failure.trap(IncorrectPreviousVersionException, Exception)
                err = failure.value
                if isinstance(err, IncorrectPreviousVersionException):
                    BoxHandler.log(logging.DEBUG, "Incorrect previous version", extra = {"request": request, "token": token})
                    actual_version = err.version
                    return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
                else:
                    BoxHandler.log(logging.ERROR, "Exception trying to delete from store: {0}".format(err), extra = {"request": request, "token": token})
                    return self.return_internal_error(request)

            d.addCallbacks(lambda new_version_info: self.return_created(request,{"data":new_version_info}), # callback
                handle_add_error) #errback

        token.get_store().addCallbacks(store_cb, err_cb)


BoxHandler.subhandlers = [
    {
        "prefix": "files",
        'methods': ['GET', 'PUT', 'DELETE'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['read', 'write'], # split this function into separate ones to allow for read-only file reading
        'force_get': True, # force the token function to get it from the query string for every method
        'handler': BoxHandler.files,
        'accept':['*/*'],
        'content-type':'application/json'
        },
    {
        "prefix": "set_acl",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['control'],
        'handler': BoxHandler.set_acl,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "get_object_ids",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['read'],
        'handler': BoxHandler.get_object_ids,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "diff",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['read'],
        'handler': BoxHandler.diff,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "query",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['read'],
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
        'require_acl': ['read'],
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
        'require_acl': ['write'],
        'handler': BoxHandler.do_PUT,
        'accept':['application/json'],
        'content-type':'application/json'        
        },
    {
        "prefix": "*",       
        'methods': ['DELETE'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['owner'],
        'handler': BoxHandler.do_DELETE,
        'accept':['application/json'],
        'content-type':'application/json'        
        },
    {
        'prefix':'*',
        'methods': ['OPTIONS'],
        'require_auth': False,
        'require_token': False,
        'require_acl': [],
        'handler': BaseHandler.return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        }
]

        
