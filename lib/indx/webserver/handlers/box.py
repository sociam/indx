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

import logging, json, cjson
import traceback
from indx import UNAUTH_USERNAME
from indx.webserver.handlers.base import BaseHandler
from indx.objectstore_async import IncorrectPreviousVersionException, FileNotFoundException
from indx.user import IndxUser
from indx.crypto import generate_rsa_keypair, rsa_encrypt, load_key, sha512_hash, make_encpk2

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


    def options(self, request, token):
        BoxHandler.log(logging.DEBUG, "BoxHandler OPTIONS request.", extra = {"request": request})
        self.return_ok(request)

    def apply_diff(self, request, token):
        """ Apply a diff to a box """
        if not token:
            BoxHandler.log(logging.DEBUG, "BoxHandler apply_diff request (token not valid), args are: {0}".format(request.args), extra = {"request": request})
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler apply_diff err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler diff request, args are: {0}".format(request.args), extra = {"request": request, "token": token})

            try:
                diff = self.get_arg(request, "data")
                if diff is None:
                    raise Exception("data argument not specified, or blank.")
                #diff = cjson.decode(diff, all_unicode=True)
                diff = json.loads(diff)
            except Exception as e:
                BoxHandler.log(logging.ERROR, "Exception in box.apply_diff getting argument from_version: {0}".format(e), extra = {"request": request, "token": token})
                return self.return_bad_request(request, "Error getting valid diff from the 'data' argument")

            diff_data = diff['data']
            commits = diff['@commits']
            store.apply_diff(diff_data, commits).addCallbacks(lambda empty: self.return_ok(request), lambda failure: self.return_internal_error(request))

        token.get_store().addCallbacks(store_cb, err_cb)


    def diff(self, request, token):
        """ Return the objects (or ids of objects) that have changes between two versions of the objectstore.
        """
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
            if to_version is not None:
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


    def link_remote_box(self, request, token):
        """ Link a remote box with this box. """
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler link_remote_box", extra = {"request": request, "token": token})

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler link_remote_box err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def setacl_cb(empty):
            remote_address = self.get_arg(request, "remote_address")
            remote_box = self.get_arg(request, "remote_box")
            remote_token = self.get_arg(request, "remote_token")

            if remote_address is None or remote_box is None or remote_token is None:
                BoxHandler.log(logging.ERROR, "BoxHandler link_remote_box: remote_address, remote_box or remote_token was missing.", extra = {"request": request, "token": token})
                return self.remote_bad_request(request, "remote_address, remote_box or remote_token was missing.")

            def synced_cb(indxsync):

                def sync_complete_cb(empty):

                    def linked_cb(remote_public_key):

                        # encrypt the user's password using the remote public key, and store
                        # XXX do we need this still? obsolete since enc_pk2 handled in sync
                        #encrypted_remote_pw = rsa_encrypt(load_key(remote_public_key), token.password)

                        self.return_created(request)

                    indxsync.link_remote_box(token.username, token.password, remote_address, remote_box, remote_token, self.webserver.server_id).addCallbacks(linked_cb, err_cb)

                indxsync.sync_boxes().addCallbacks(sync_complete_cb, err_cb)

            self.webserver.sync_box(token.boxid).addCallbacks(synced_cb, err_cb)
      
        # give read-write access to the @indx user so that the webserver can connect with the user being present
        user = IndxUser(self.database, token.username)
        user.set_acl(token.boxid, "@indx", {"read": True, "write": True, "control": False, "owner": False}).addCallbacks(setacl_cb, lambda failure: self.return_internal_error(request))

    def generate_new_key(self, request, token):
        """ Generate a new key and store it in the keystore. Return the public and public-hash parts of the key. """
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler generate_new_key", extra = {"request": request, "token": token})

        is_linked = self.get_arg(request, "is-linked", default = False)

        remote_public = self.get_arg(request, "public")
        remote_hash = self.get_arg(request, "public-hash")
        remote_encpk2 = self.get_arg(request, "encpk2")
        remote_serverid = self.get_arg(request, "serverid")

        if not remote_public or not remote_hash or not remote_encpk2 or not remote_serverid:
            BoxHandler.log(logging.ERROR, "BoxHandler generate_new_key: public, public-hash, encpk2, or serverid was missing.", extra = {"request": request, "token": token})
            return self.remote_bad_request(request, "public, public-hash, encpk2 or serverid was missing.")

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler generate_new_key err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        if type(remote_encpk2) != type(""):
            remote_encpk2 = json.dumps(remote_encpk2) 
        remote_encpk2_hsh = sha512_hash(remote_encpk2)

        local_keys = generate_rsa_keypair(3072)

        def store_cb(store):

            def setacl_cb(empty):

                def created_cb(empty):

                    def saved_cb(empty):
                        def servervar_cb(empty):

        #                    encpk2 = rsa_encrypt(load_key(local_keys['public']), token.password)
                            encpk2 = make_encpk2(local_keys, token.password)

                            self.return_created(request, {"data": {"public": local_keys['public'], "public-hash": local_keys['public-hash'], "encpk2": encpk2, "serverid": self.webserver.server_id}})

                        if is_linked:
                            self.database.save_linked_box(token.boxid).addCallbacks(servervar_cb, err_cb)
                        else:
                            servervar_cb(None)

                    self.database.save_encpk2(remote_encpk2_hsh, remote_encpk2, remote_serverid).addCallbacks(saved_cb, err_cb)

                def new_key_added_cb(empty):
                    self.webserver.keystore.put(local_keys, token.username, token.boxid).addCallbacks(created_cb, err_cb) # store in the local keystore

                remote_keys = {"public": remote_public, "public-hash": remote_hash, "private": ""}
                self.webserver.keystore.put(remote_keys, token.username, token.boxid).addCallbacks(new_key_added_cb, err_cb)

            user = IndxUser(self.database, token.username)
            user.set_acl(token.boxid, "@indx", {"read": True, "write": True, "control": False, "owner": False}).addCallbacks(setacl_cb, lambda failure: self.return_internal_error(request))

#            store.apply_diff(remote_diff['data'], remote_diff['@commits']).addCallbacks(applied_cb, lambda failure: self.return_internal_error(request))

        token.get_store().addCallbacks(store_cb, lambda failure: self.return_internal_error(request))


    def get_acls(self, request, token):
        """ Get all of the ACLs for this box.

            You must have 'control' permission to be able to do this.
        """
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler get_acls", extra = {"request": request, "token": token})

        user = IndxUser(self.database, token.username)
        
        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler get_acls err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        user.get_acls(token.boxid).addCallbacks(lambda results: self.return_ok(request, {"data": results}), err_cb)



    def set_acl(self, request, token):
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
        if not token:
            return self.return_forbidden(request)
        BoxHandler.log(logging.DEBUG, "BoxHandler set_acl", extra = {"request": request, "token": token})

        user = IndxUser(self.database, token.username)

        # box is set by the token (token.boxid)
        try:
            req_acl = json.loads(self.get_arg(request, "acl"))
        except Exception as e:
            BoxHandler.log(logging.ERROR, "Exception in box.set_acl decoding JSON in query, 'acl': {0}".format(e), extra = {"request": request, "token": token})
            return self.return_bad_request(request, "Specify acl as query string parameter 'acl' as valid JSON")

        try:
            req_username = self.get_arg(request, "target_username") # username of the user of which to change the ACL
            if req_username is None:
                raise Exception("")
        except Exception as e:
            try:
                req_public = self.get_arg(request, "unauth_user")
                if req_public:
                    req_username = UNAUTH_USERNAME # use the magic reserved username in the DB for the unauth user permissions
                else:
                    return self.return_bad_request(request, "If 'target_username' is not specified, then 'unauth_user' must be set true.")
            except Exception as e:
                return self.return_bad_request(request, "If 'target_username' is not specified, then 'unauth_user' must be set true.")
                

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler set_acl err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        user.set_acl(token.boxid, req_username, req_acl).addCallbacks(lambda empty: self.return_ok(request), err_cb)


    def get_object_ids(self, request, token):
        """ Get a list of object IDs in this box.
        """
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


    def query(self, request, token):
        """ Perform a query against the box, and return matching objects.
        """
        if not token:
            return self.return_forbidden(request)
 
        depth = self.get_arg(request, "depth", default = None)
        if depth is not None:
            depth = int(depth)

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

                if depth is None:
                    store.query(q, predicate_filter = predicate_list).addCallbacks(lambda results: self.return_ok(request, {"data": results}), # callback
                        handle_add_error) # errback
                else:
                    store.query(q, predicate_filter = predicate_list, depth = depth).addCallbacks(lambda results: self.return_ok(request, {"data": results}), # callback
                        handle_add_error) # errback
            except Exception as e:
                BoxHandler.log(logging.ERROR, "Exception in box.query: {0}".format(e), extra = {"request": request, "token": token})
                return self.return_internal_error(request)

        token.get_store().addCallbacks(store_cb, err_cb)

    
    def files(self, request, token):
        """ Handler for queries like /box/files?id=notes.txt&version=2

            Handles GET, PUT and DELETE of files.
            Sending current version in the request is required as in the JSON requests.

            request -- Twisted request object.
        """
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

    def get_version(self, request, token):
        BoxHandler.log(logging.DEBUG, "BoxHandler get_version")

        if not token:
            return self.return_forbidden(request)

        def err_cb(failure):
            failure.trap(Exception)
            BoxHandler.log(logging.ERROR, "BoxHandler get_version err_cb: {0}".format(failure), extra = {"request": request, "token": token})
            return self.return_internal_error(request)

        def store_cb(store):
            store.setLoggerClass(BoxHandler, extra = {"token": token, "request": request})
            BoxHandler.log(logging.DEBUG, "BoxHandler get_version", extra = {"request": request, "token": token})

            store._get_latest_ver().addCallbacks(lambda version: self.return_ok(request, {"data": version}), err_cb)

        token.get_store().addCallbacks(store_cb, err_cb)


    def do_GET(self,request,token):
        BoxHandler.log(logging.DEBUG, "BoxHandler do_GET >", extra={"request": request, "token": token})

        if not token:
            BoxHandler.log(logging.DEBUG, "Boxhandler do_GET: No token, returning forbidden straight away.", extra={"request": request, "token": token})
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
                return store.get_latest_objs(id_list).addCallbacks(lambda obj: self.return_ok(request, obj), err_cb)
            else:
                BoxHandler.log(logging.DEBUG, "BoxHandler GET request no id {0}".format(request))
                # return the whole box
                return store.get_latest().addCallbacks(lambda obj: self.return_ok(request, obj), err_cb)

        token.get_store().addCallbacks(store_cb, err_cb)
   

    def do_PUT(self,request, token):
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
            #objs = cjson.decode(self.get_arg(request, "data"), all_unicode=True)

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


    def do_DELETE(self,request,token):
        """ Handle DELETE calls. Requires a JSON array of object IDs in the body as the 'data' argument:
            e.g.,

            ['obj_123','obj_456']

            and the current box version as the 'version' argument. If the version is incorrect, a 409 Obsolete is returned.

            request -- The twisted request object
        """

        # get validated token
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

    def box_return_ok(self,request,token):
        return self.return_ok(request)

BoxHandler.subhandlers = [
    {
        "prefix": "files",
        'methods': ['GET', 'PUT', 'DELETE'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['write'], # split this function into separate ones to allow for read-only file reading
        'force_get': True, # force the token function to get it from the query string for every method
        'handler': BoxHandler.files,
        'accept':['*/*'],
        'content-type':'application/json'
        },
    {
        "prefix": "link_remote_box",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['control'],
        'handler': BoxHandler.link_remote_box,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "generate_new_key",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['control'],
        'handler': BoxHandler.generate_new_key,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "get_version",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['read'],
        'handler': BoxHandler.get_version,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "get_acls",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['control'],
        'handler': BoxHandler.get_acls,
        'accept':['application/json'],
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
        "prefix": "apply_diff",
        'methods': ['PUT'],
        'require_auth': False,
        'require_token': True,
        'require_acl': ['write'],
        'handler': BoxHandler.apply_diff,
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
        'require_acl': ['write'],
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
        'handler': BoxHandler.box_return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        }
]

        
