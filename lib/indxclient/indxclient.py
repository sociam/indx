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

import logging
import json
import urllib
import urllib2
import cookielib
import uuid
import pprint
import cjson
import base64
import traceback
import Crypto.Random.OSRNG.posix
import Crypto.PublicKey.RSA
import Crypto.Hash.SHA512
from twisted.internet import reactor, threads
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from autobahn.twisted.websocket import connectWS, WebSocketClientFactory, WebSocketClientProtocol

# Decorator function to ensure that the IndxClient object has a token when the function requires one
def require_token(function):
    def wrapper(self, *args, **kwargs):
        self._debug("require_token, token is: {0}".format(self.token))
        if self.token is None:
            logging.error("require_token, throwing exception")
            raise Exception("Non-null token required for this call.")
        logging.debug("require_token, self: {0}, *args: {1}, **kwargs: {2}".format(self, args, kwargs))
        return function(self, *args, **kwargs)
    return wrapper

def value_truncate(data, max_length = 255):
    """ Truncate a string before logging it (e.g. for file data). """
    if data is None:
        return data

    if len(data) > max_length:
        return data[:max_length] + "...[truncated, original length {0}]".format(len(data))
    else:
        return data


class IndxClient:
    """ Authenticates and accesses an INDX. """

    def __init__(self, address, box, appid, token = None, client = None):
        """ Connect to an INDX and authenticate. """
        self.address = address
        self.box = box
        self.token = token
        self.appid = appid

        self.params = {"app": self.appid}
        if self.token is not None:
            self.params["token"] = self.token
        if self.box is not None:
            self.params["box"] = self.box # used in requests

        if client is None:
            self.client = IndxHTTPClient(self.params)
        else:
            self.client = client

        self.client.params = self.params

        """ Ensure self.server always ends in a / """
        if self.address[-1:] != "/":
            self.address += "/"

        self.base = "{0}{1}".format(self.address, self.box)


    def _log(self, loglevel, message):
        """ Write a log message including the server and box information. """
        logger = logging.getLogger("indxclient")
        return logger.log(loglevel, u"%s\t%s\t%s\t%s", self.address, self.box, self.token, message)
    
    def _debug(self, message):
        return self._log(logging.DEBUG, message)

    def _error(self, message):
        return self._log(logging.ERROR, message)


    # Utility Functions

    def _gen_bnode_id(self):
        """ Generate an ID for a bnode. """
        return "_:{0}".format(uuid.uuid4()) # uuid4 to avoid collisions - uuid1 can (and did) cause collisions


    def _prepare_objects(self, objects):
        """ Take raw JSON object and expand them into the INDX internal format. """
        logging.debug("IndxClient _prepare_objects: {0}".format(objects))

        objects_new = []

        if type(objects) != type([]):
            objects = [objects]

        for obj in objects:
            if "@id" not in obj:
                raise Exception("@id required in all objects.")

            obj_new = {}

            for predicate, sub_objs in obj.items():
                if predicate[0] == "@" or predicate[0] == "_":
                    obj_new[predicate] = sub_objs
                    continue # ignore internal non-data predicates

                if sub_objs is None:
                    continue

                if type(sub_objs) != type([]):
                    sub_objs = [sub_objs]

                for object in sub_objs:
                    if type(object) != type({}):

                        if type(object) != type(u"") and type(object) != type(""):
                            object = unicode(object)
                        object = {"@value": object} # turn single value into a literal

                    # check if 'object' is an object value or if it is a subobject
                    if "@value" in object or "@id" in object:
                        # this object is a value
                        if predicate not in obj_new:
                            obj_new[predicate] = []
                        obj_new[predicate].append(object)
                    else:
                        # this is a subobject, so rescursively process it
                        new_id = self._gen_bnode_id()
                        object["@id"] = new_id
                        sub_obj = self._prepare_objects(object)
                        if len(sub_obj) > 0 and sub_obj[0] is not None: 
                            if predicate not in obj_new:
                                obj_new[predicate] = []
                            obj_new[predicate].append({"@id": new_id}) # link to new object
                            objects_new.extend(sub_obj) # add new object to object list

            if len(obj_new.keys()) > 0:
                objects_new.append(obj_new)

        return objects_new

    @staticmethod
    def requires_token(call):
        requires = [
            'get_object_ids',
            'update_raw',
            'update',
            'delete',
            'get_latest',
            'get_by_ids',
            'query',
            'set_acl',
            'get_acls',
            'generate_new_key',
            'diff',
            'add_file',
            'delete_file',
            'get_file',
            'list_files',
            'link_remote_box',
            'get_version',
        ]
        return call.func_name in requires


    # API access functions

    def create_box(self):
        """ Create a box. """
        self._debug("Called API: create_box")

        url = "{0}admin/create_box".format(self.address)
        values = {"name": self.box}
        return self.client.post(url, values)

    def delete_box(self):
        """ Delete a box. """
        self._debug("Called API: delete_box")

        url = "{0}admin/delete_box".format(self.address)
        values = {"name": self.box}
        return self.client.post(url, values)

    def list_boxes(self):
        """ List the boxes on the INDX server. """
        self._debug("Called API: list_boxes")

        url = "{0}admin/list_boxes".format(self.address)
        return self.client.get(url)

    def create_root_box(self, box):
        """ Create a new root box for a user on the INDX server. """
        self._debug("Called API: create_root_box with box {0}".format(box))

        url = "{0}admin/create_root_box".format(self.address)
        values = {"box": box}
        return self.client.get(url, values)

    def create_user(self, username, password):
        """ Create a new user. """
        self._debug("Called API: create_user with username: {0}".format(username))

        url = "{0}admin/create_user".format(self.address)
        values = {"username": username, "password": password}
        return self.client.post(url, values)

    @require_token
    def get_object_ids(self):
        """ Get the IDs of every object in this box. """
        self._debug("Called API: get_object_ids")

        url = "{0}/get_object_ids".format(self.base)
        return self.client.get(url)

    @require_token
    def update_raw(self, version, objects):
        """ Update objects in a box, in INDX format.
        
            version -- The current version of the box
            objects -- List of objects to create/update
        """
        self._debug("Called API: update_raw with version: {0}, objects: {1}".format(version, objects)) 

        values = {"data": cjson.encode(objects), "version": version}
        return self.client.put(self.base, values)

    @require_token
    def update(self, version, objects):
        """ Update objects in a box, from any JSON format.
        
            version -- The current version of the box
            objects -- List of objects to create/update
        """
        self._debug("Called API: update with version: {0}, objects: {1}".format(version, objects)) 

        prepared_objects = self._prepare_objects(objects)
        self._debug("update: prepared_objects: {0}".format(pprint.pformat(prepared_objects, indent=2, width=80)))
        
        values = {"data": cjson.encode(prepared_objects), "version": version}
        return self.client.put(self.base, values)

    @require_token
    def delete(self, version, object_id_list):
        """ Test to delete objects from a box.
        
            version -- The current version of the box
            object_id_list -- List of object IDs to delete
        """
        self._debug("Called API: delete with version: {0}, object_id_list: {1}".format(version, object_id_list)) 

        values = {"data": json.dumps(object_id_list), "version": version}
        return self.client.delete(self.base, values)

    @require_token
    def get_version(self):
        """ Get the latest version number. """
        self._debug("Called API: get_version")

        url = "{0}/get_version".format(self.base)
        return self.client.get(url)

    def get_latest(self):
        """ Get the latest version of every object in this box. """
        self._debug("Called API: get_latest")

        return self.client.get(self.base)

    @require_token
    def get_by_ids(self, object_id_list):
        """ Get the latest version of specific objects in this box.
        
            object_id_list -- A list of object IDs to retrieve
        """
        self._debug("Called API: get_by_ids with object_ids_list: {0}".format(object_id_list))

        id_tuples = map(lambda i: ("id", i), object_id_list)
        return self.client.get(self.base, id_tuples)

    @require_token
    def query(self, query, depth = None):
        """ Query a box with a filtering query

            query -- The query to send, as a dict, e.g. {"@id": 2983} or {"firstname": "dan"}
            depth -- How deep into the object graph/hierarchy to return full objects
        """
        self._debug("Called API: query with query: {0}".format(query))

        params = {'q': query}
        if depth is not None:
            params['depth'] = depth

        url = "{0}/query".format(self.base)
        return self.client.get(url, params)

    @require_token
    def set_acl(self, acl, target_username):
        """ Set an ACL on a database for a target username.

            acl -- The ACL to set, must have "read", "write" and "control" fields, all boolean, e.g. {"read": true, "write": true, "control": false}
            target_username -- username of the user whose access will be set/change
        """
        self._debug("Called API: set_acl with acl: {0}, target_username: {1}".format(acl, target_username))

        url = "{0}/set_acl".format(self.base)
        return self.client.get(url, {'acl': acl, 'target_username': target_username})

    @require_token
    def get_acls(self):
        """ Get ACLs for a database (requires "control" permissions)"""
        self._debug("Called API: get_acls")

        url = "{0}/get_acls".format(self.base)
        return self.client.get(url)

    @require_token
    def generate_new_key(self, local_key):
        """ Generate new key and store it in the keystore, send our public (not private) key to the remote server. Return the public and public-hash parts. (Not the private part.)  """
        self._debug("Called API: generate_new_key")

        url = "{0}/generate_new_key".format(self.base)
        values = {"public": local_key['public'], "public-hash": local_key['public-hash']} # don't send private to anyone ever
        return self.client.get(url, values)

    @require_token
    def diff(self, return_objs, from_version, to_version = None):
        """ Get the difference between two versions of the objects in the box.
        
            return_objs -- How to return the results, either "diff", "objects", "ids".
                "diff" means that a diff (added, changed, removed) will be returned
                "objects" means that the "to" version of full objects that have been changed will be returned
                "ids" means that the ids of objects that have changed will be returned
            from_version -- The base version of the diff
            to_version -- The end version of the diff (optional, defaults to latest version)
        """
        self._debug("Called API: diff with return_objs: {0}, from_version: {1}, to_version: {2}".format(return_objs, from_version, to_version))

        url = "{0}/diff".format(self.base)
        params = {'from_version': from_version, "return_objs": return_objs}

        if to_version is not None:
            params['to_version'] = to_version

        return self.client.get(url, params)

    @require_token
    def add_file(self, version, file_id, file_data, contenttype):
        """ Add a file to the database.
        
            version -- The latest version of the box
            file_id -- The file ID
            file_data -- The actual file data to upload
            contenttype -- The Content-Type of the file
        """
        self._debug("Called API: add_file with version: {0}, file_id: {1}, contenttype: {2}, file_data: {3}".format(version, file_id, contenttype, value_truncate(file_data)))

        url = "{0}/files".format(self.base)
        values = {"id": file_id, "version": version}
        return self.client.req_file(url, values, "PUT", file_data, contenttype)

    @require_token
    def delete_file(self, version, file_id):
        """ Delete a file from the database.
        
            version -- The latest version of the box
            file_id -- The file ID to delete
        """
        self._debug("Called API: delete with version: {0}, file_id: {1}".format(version, file_id))

        url = "{0}/files".format(self.base)
        values = {"id": file_id, "version": version}
        return self.client.get(url, values, method = "DELETE")

    @require_token
    def get_file(self, file_id):
        """ Get the latest version of a file from the database.
        
            file_id -- The file ID to retrieve
        """
        self._debug("Called API: get_file with file_id: {0}".format(file_id))

        url = "{0}/files".format(self.base)
        params = {'id': file_id}
        return self.client.get(url, params, raw = True)

    @require_token
    def list_files(self):
        """ Get a list of the files in the latest version of the box. """
        self._debug("Called API: list_files")

        url = "{0}/files".format(self.base)
        return self.client.get(url)

    @require_token
    def link_remote_box(self, remote_address, remote_box, remote_token):
        """ Link a remote box with a local box. """
        self._debug("Called API: link_remote_box, on remote_address '{0}', remote_box '{1}', remote_token '{2}'".format(remote_address, remote_box, remote_token))

        url = "{0}/link_remote_box".format(self.base)
        return self.client.get(url, {'remote_address': remote_address, 'remote_box': remote_box, 'remote_token': remote_token})

    @require_token
    def listen_diff(self, observer):
        """ Listen to this box using a websocket. Call the observer when there's an update. """

        address = self.address + "ws"

        if address[0:6] == "https:":
            address = "wss" + address[5:]
        elif address[0:5] == "http:":
            address = "ws" + address[4:]
        else:
            raise Exception("IndxClient: Unknown scheme to URL: {0}".format(address))

        wsclient = IndxWebSocketClient(address, self.token, observer)


class IndxWebSocketClient:
    def __init__(self, address, token, observer):
        self.address = address
        self.token = token
        indx_observer = observer

        logging.debug("IndxWebSocketClient opening to {0}".format(self.address))

        class IndxClientProtocol(WebSocketClientProtocol):

            def onMessage(self, payload, isBinary):
                try:
                    logging.debug("IndxClientProtocol onMessage, payload {0}".format(payload))
                    data = cjson.decode(payload)
                    self.on_response(data)
                except Exception as e:
                    logging.error("IndxWebSocketClient Exception: {0}".format(e))
                    logging.error(traceback.format_exc())
                    logging.error("IndxWebSocketClient can't decode JSON, ignoring message: {0}".format(payload))


            def onOpen(self):
                msg = {"action": "auth", "token": token}
                self.on_response = self.respond_to_auth
                self.sendMessage(cjson.encode(msg))

            # manage state by setting a response function each time
            def send_to_observer(self, data):
                indx_observer(data)

            def respond_to_auth(self, data):
                if data['success']:
                    self.on_response = self.send_to_observer
                    msg = {"action": "diff", "operation": "start"}
                    self.sendMessage(cjson.encode(msg))
                else:
                    logging.error("IndxWebSocketClient WebSocket auth failure.")


        self.factory = WebSocketClientFactory(self.address)
        self.factory.protocol = IndxClientProtocol
        connectWS(self.factory)


class IndxHTTPClient:
    """ An HTTP requests client with cookie jar. """

    def __init__(self, params):
        self.params = params

        """ Set up a cookies-enabled opener locally. """
        self.cj = cookielib.LWPCookieJar()
        self.opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(self.cj))

    def get_session_identifier(self, address):
        """ Get the identifier for the INDX session (initiates a session if necessary). """
        return_d = Deferred()

        def check_cookies():
            for cookie in self.cj:
                logging.debug("COOKIE: {0}".format(cookie))
                if cookie.name == "TWISTED_SESSION":
                    return cookie.value
            return None

        existing = check_cookies()
        if existing is not None:
            return_d.callback(existing)
        else:

            def whoami_cb(response):
                session_id = check_cookies()
                if session_id is not None:
                    return_d.callback(session_id)
                else:
                    return_d.errback(Failure(Exception("No session ID was available ")))

            # do a request to start a session and get a cookie
            self.get("{0}auth/whoami".format(address)).addCallbacks(whoami_cb, return_d.errback)
        return return_d


    def get(self, url, values = None, raw = False, method = "GET"):
        """ Do a GET, decode the result JSON and return it. """
        logging.debug("GET request with url: {0}, values: {1}".format(url, values))
        url += "?" + self._encode(values)
        return self._req(method, url, raw = raw)

    def put(self, url, values, content_type="application/json"):
        """ Do a PUT, decode the result JSON and return it. """
        logging.debug("PUT request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "PUT", content_type)

    def post(self, url, values, content_type="application/json"):
        """ Do a POST, decode the result JSON and return it. """
        logging.debug("POST request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "POST", content_type)

    def delete(self, url, values, content_type="application/json"):
        """ Do a DELETE, decode the result JSON and return it. """
        logging.debug("DELETE request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "DELETE", content_type)

    def req_file(self, url, values, method, body, content_type):
        """ Do an HTTP request with arguments in the URL, and file data as the body. """
        url += "?" + self._encode(values)
        headers = [("Content-Type", content_type)]
        logging.debug("File request with url: {0}, values: {1}, method: {2}, headers: {3}, body: {4}".format(url, values, method, headers, value_truncate(body)))
        return self._req(method, url, body = body, headers = headers)


    def _req(self, method, url, body = None, raw = False, headers = []):
        """ HTTP request. Uses the global cookie jar. """
        logging.debug("HTTP Request of url: {0}, method: {1}, raw: {2}, headers: {3}, body: {4}".format(url, method, raw, headers, value_truncate(body)))
        return_d = Deferred()

        def do_req():
            req = urllib2.Request(url, body)
            for header in headers:
                req.add_header(header[0], header[1])
            req.get_method = lambda: method
            response = self.opener.open(req)
            the_page = response.read()

            logging.debug("HTTP Request: response headers: {0}".format(response.info().headers))
            if raw:
                logging.debug("HTTP Request, returning raw results")
                return the_page
            else:
                logging.debug("HTTP Request, raw results: {0}".format(value_truncate(the_page)))
                status = json.loads(the_page)
                logging.debug("HTTP Request, returning JSON decoded results: {0}".format(status))
                return status

        threads.deferToThread(lambda empty: do_req(), None).addCallbacks(return_d.callback, return_d.errback)
        return return_d

    def _encode(self, values):
        """ Encode some values, either a dict or a list of tuples. """
        logging.debug("Encode called with values: {0}".format(values))

        # encode values separately because values may be a list of tuples
        params = urllib.urlencode(self.params)

        if values is None or len(values) == 0:
            logging.debug("Encode is returning basic params: {0}".format(params))
            return params

        encoded = params + "&" + urllib.urlencode(values)
        logging.debug("Encode is returning encoded values: {0}".format(encoded))
        return encoded

    def _req_body(self, url, values, method, content_type):
        """ Do an HTTP request with arguments in the body (POST/PUT/DELETE etc), using the specified method.
        """
        headers = [("Content-Type", content_type)]
        logging.debug("Body request with url: {0}, values: {1}, method: {2}, headers: {3}".format(url, values, method, headers))
        return self._req(method, url, body = self._encode(values), headers = headers)


class IndxClientAuth:
    """ Authenticate to INDX servers, and get tokens. """

    def __init__(self, address, appid, client = None):
        self.address = address
        self.appid = appid

        self.params = {"app": self.appid}

        self.is_authed = False

        """ Ensure self.server always ends in a / """
        if self.address[-1:] != "/":
            self.address += "/"

        if client is None:
            self.client = IndxHTTPClient(self.params)
        else:
            self.client = client

    # Logging Functions

    def _log(self, loglevel, message):
        """ Write a log message including the server and box information. """
        logger = logging.getLogger("indxclientauth")
        return logger.log(loglevel, u"%s\t%s", self.address, message)
    
    def _debug(self, message):
        return self._log(logging.DEBUG, message)

    def _error(self, message):
        return self._log(logging.ERROR, message)

    # Authentication Functions

    def get_token(self, boxid):
        """ Get a token for this box. """
        return_d = Deferred()

        try:
            if not self.is_authed:
                return_d.errback(Failure(Exception("Must authenticate before getting token.")))
                return return_d

            url = "{0}auth/get_token".format(self.address)
            values = {"box": boxid, "app": self.appid}

            self._debug("Getting token")

            def responded_cb(status):
                if status['code'] != 200:
                    errmsg = "Getting a token failed"
                    self._error(errmsg)
                    raise Exception(errmsg)

                self._debug("Getting a token was successful: {0}".format(status['token']))
                return_d.callback(status['token'])

            self.client.post(url, values).addCallbacks(responded_cb, return_d.errback)

        except Exception as e:
            return_d.errback(Failure(e))

        return return_d

    def auth_plain(self, username, password):
        """ Plain authentication. """
        return_d = Deferred()
        try:
            self.is_authed = False

            url = "{0}auth/login".format(self.address)
            values = {"username": username, "password": password}

            self._debug("Calling auth_plain")     

            # TODO change client.post etc to be async using twisted web clients
            def responded_cb(status):
                if status['code'] != 200:
                    errmsg = "Authentication failed"
                    self._error(errmsg)
                    raise Exception(errmsg)

                self._debug("Authentication successful")
                self.is_authed = True
                return_d.callback(status)
            
            self.client.post(url, values).addCallbacks(responded_cb, return_d.errback)

        except Exception as e:
            return_d.errback(Failure(e))

        return return_d


    def auth_keys(self, private_key, key_hash):
        """ Key based authentication, similar to RFC4252. """
        return_d = Deferred()
        try:
            SSH_MSG_USERAUTH_REQUEST = "50"
            method = "publickey"
            algo = "SHA512"

            self.is_authed = False

            def session_id_cb(sessionid):
                ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, sessionid, method, algo, key_hash)
                signature = self.rsa_sign(private_key, ordered_signature_text)

                url = "{0}auth/login_keys".format(self.address)
                values = {"signature": signature, "key_hash": key_hash, "algo": algo, "method": method}

                self._debug("Calling auth_keys")

                def responded_cb(status):
                    if status['code'] != 200:
                        errmsg = "Authentication failed"
                        self._error(errmsg)
                        raise Exception(errmsg)

                    self._debug("Authentication successful")
                    self.is_authed = True
                    return_d.callback(status)
                
                # TODO change client.post etc to be async using twisted web clients
                self.client.post(url, values).addCallbacks(responded_cb, return_d.errback)

            self.client.get_session_identifier(self.address).addCallbacks(session_id_cb, return_d.errback)

        except Exception as e:
            return_d.errback(Failure(e))

        return return_d

    # PKI functions from indx.crypto (copied to remove the depency on INDX.)
    def rsa_sign(self, private_key, plaintext):
        """ Hash and sign a plaintext using a private key. Verify using rsa_verify with the public key. """
        hsh = self.sha512_hash(plaintext)
        PRNG = Crypto.Random.OSRNG.posix.new().read
        signature = private_key.sign(hsh, PRNG)
        return signature[0]

    def sha512_hash(self, src):
        h = Crypto.Hash.SHA512.new()
        h.update(src)
        return h.hexdigest()

