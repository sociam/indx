#    This file is part of INDX.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with INDX.  If not, see <http://www.gnu.org/licenses/>.

import logging, json, urllib, urllib2, cookielib


# Decorator function to ensure that the webbox object has a token when the function requires one
def require_token(function):
    def wrapper(self, *args, **kwargs):
        self._debug("require_token, token is: {0}".format(self.token))
        if self.token is None:
            self.get_token()
        logging.debug("require_token, self: {0}, *args: {1}, **kwargs: {2}".format(self, args, kwargs))
        return function(self, *args, **kwargs)
    return wrapper


class WebBox:
    """ Authenticates and accesses a WebBox. """

    def __init__(self, address, box, username, password, appid, token = None):
        """ Connect to a WebBox and authenticate. """
        self.address = address
        self.box = box
        self.username = username
        self.password = password
        self.token = token
        self.appid = appid

        """ Ensure self.server always ends in a / """
        if self.address[-1:] != "/":
            self.address += "/"

        self.base = "{0}{1}".format(self.address, self.box)

        """ Set up a cookies-enabled opener locally. """
        cj = cookielib.LWPCookieJar()
        self.opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cj))

        self.params = {"app": self.appid, "token": self.token, "box": self.box} # used in requests
        self.auth()

    def _truncate(self, data, max_length = 255):
        """ Truncate a string before logging it (e.g. for file data). """
        if data is None:
            return data

        if len(data) > max_length:
            return data[:max_length] + "...[truncated, original length {0}]".format(len(data))
        else:
            return data

    def _log(self, loglevel, message):
        """ Write a log message including the server and box information. """
        logger = logging.getLogger("pywebbox")
        return logger.log(loglevel, u"%s\t%s\t%s\t%s\t%s", self.address, self.box, self.username, self.token, message)
    
    def _debug(self, message):
        return self._log(logging.DEBUG, message)

    def _error(self, message):
        return self._log(logging.ERROR, message)

    def auth(self):
        """ Authenticate to a WebBox, and get a token. """
        url = "{0}auth/login".format(self.address)
        values = {"username": self.username, "password": self.password}

        self._debug("Calling auth")
        status = self._post(url, values)

        if status['code'] != 200:
            errmsg = "Authentication failed"
            self._error(errmsg)
            raise Exception(errmsg)

        self._debug("Authentication successful")

    def get_token(self):
        """ Get a token for this box. """
        url = "{0}auth/get_token".format(self.address)
        values = {"box": self.box, "app": self.appid}

        self._debug("Getting token")
        status = self._post(url, values)

        if status['code'] != 200:
            errmsg = "Getting a token failed"
            self._error(errmsg)
            raise Exception(errmsg)
        else:
            self._debug("Getting a token was successful: {0}".format(status['token']))
            self.params['token'] = status['token']
            self.token = status['token']

    
    # Utility Functions

    def _req(self, method, url, body = None, raw = False, headers = []):
        """ HTTP request. Uses the global cookie jar. """
        self._debug("HTTP Request of url: {0}, method: {1}, raw: {2}, headers: {3}, body: {4}".format(url, method, raw, headers, self._truncate(body)))

        req = urllib2.Request(url, body)
        for header in headers:
            req.add_header(header[0], header[1])
        req.get_method = lambda: method
        response = self.opener.open(req)
        the_page = response.read()

        self._debug("HTTP Request: response headers: {0}".format(response.info().headers))
        if raw:
            self._debug("HTTP Request, returning raw results")
            return the_page
        else:
            self._debug("HTTP Request, raw results: {0}".format(self._truncate(the_page)))
            status = json.loads(the_page)
            self._debug("HTTP Request, returning JSON decoded results: {0}".format(status))
            return status


    def _encode(self, values):
        """ Encode some values, either a dict or a list of tuples. """
        self._debug("Encode called with values: {0}".format(values))

        # encode values separately because values may be a list of tuples
        params = urllib.urlencode(self.params)

        if values is None or len(values) == 0:
            self._debug("Encode is returning basic params: {0}".format(params))
            return params

        encoded = params + "&" + urllib.urlencode(values)
        self._debug("Encode is returning encoded values: {0}".format(encoded))
        return encoded


    def _get(self, url, values = None, raw = False, method = "GET"):
        """ Do a GET, decode the result JSON and return it. """
        self._debug("GET request with url: {0}, values: {1}".format(url, values))
        url += "?" + self._encode(values)
        return self._req(method, url, raw = raw)


    def _req_body(self, url, values, method, content_type):
        """ Do an HTTP request with arguments in the body (POST/PUT/DELETE etc), using the specified method.
        """
        headers = [("Content-Type", content_type)]
        self._debug("Body request with url: {0}, values: {1}, method: {2}, headers: {3}".format(url, values, method, headers))
        return self._req(method, url, body = self._encode(values), headers = headers)


    def _req_file(self, url, values, method, body, content_type):
        """ Do an HTTP request with arguments in the URL, and file data as the body.
        """
        url += "?" + self._encode(values)
        headers = [("Content-Type", content_type)]
        self._debug("File request with url: {0}, values: {1}, method: {2}, headers: {3}, body: {4}".format(url, values, method, headers, self._truncate(body)))
        return self._req(method, url, body = body, headers = headers)


    def _delete(self, url, values, content_type="application/json"):
        """ Do a DELETE, decode the result JSON and return it.
        """
        self._debug("DELETE request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "DELETE", content_type)


    def _put(self, url, values, content_type="application/json"):
        """ Do a PUT, decode the result JSON and return it.
        """
        self._debug("PUT request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "PUT", content_type)


    def _post(self, url, values, content_type="application/json"):
        """ Do a POST, decode the result JSON and return it. """
        self._debug("POST request with url: {0}, values: {1}".format(url, values))
        return self._req_body(url, values, "POST", content_type)


    # API access functions

    def create_box(self):
        """ Create a box. """
        self._debug("Called API: create_box")

        url = "{0}admin/create_box".format(self.address)
        values = {"name": self.box}
        return self._post(url, values)

    def list_boxes(self):
        """ List the boxes on the webbox server. """
        self._debug("Called API: list_boxes")

        url = "{0}admin/list_boxes".format(self.address)
        return self._get(url)

    @require_token
    def get_object_ids(self):
        """ Get the IDs of every object in this box. """
        self._debug("Called API: get_object_ids")

        url = "{0}/get_object_ids".format(self.base)
        return self._get(url)

    @require_token
    def update_json(self, version, objects):
        pass

    @require_token
    def update(self, version, objects):
        """ Update objects in a box.
        
            version -- The current version of the box
            objects -- List of objects to create/update
        """
        self._debug("Called API: update with version: {0}, objects: {1}".format(version, objects)) 

        values = {"data": json.dumps(objects), "version": version}
        return self._put(self.base, values)

    @require_token
    def delete(self, version, object_id_list):
        """ Test to delete objects from a box.
        
            version -- The current version of the box
            object_id_list -- List of object IDs to delete
        """
        self._debug("Called API: delete with version: {0}, object_id_list: {1}".format(version, object_id_list)) 

        values = {"data": json.dumps(object_id_list), "version": version}
        return self._delete(self.base, values)

    @require_token
    def get_latest(self):
        """ Get the latest version of every object in this box. """
        self._debug("Called API: get_latest")

        return self._get(self.base)

    @require_token
    def get_by_ids(self, object_id_list):
        """ Get the latest version of specific objects in this box.
        
            object_id_list -- A list of object IDs to retrieve
        """
        self._debug("Called API: get_by_ids with object_ids_list: {0}".format(object_id_list))

        id_tuples = map(lambda i: ("id", i), object_id_list)
        return self._get(self.base, id_tuples)

    @require_token
    def query(self, query):
        """ Query a box with a filtering query

            query -- The query to send, as a dict, e.g. {"@id": 2983} or {"firstname": "dan"}
        """
        self._debug("Called API: query with query: {0}".format(query))

        url = "{0}/query".format(self.base)
        return self._get(url, {'q': query})

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

        return self._get(url, params)

    @require_token
    def add_file(self, version, file_id, file_data, contenttype):
        """ Add a file to the database.
        
            version -- The latest version of the box
            file_id -- The file ID
            file_data -- The actual file data to upload
            contenttype -- The Content-Type of the file
        """
        self._debug("Called API: add_file with version: {0}, file_id: {1}, contenttype: {2}, file_data: {3}".format(version, file_id, contenttype, self._truncate(file_data)))

        url = "{0}/files".format(self.base)
        values = {"id": file_id, "version": version}
        return self._req_file(url, values, "PUT", file_data, contenttype)

    @require_token
    def delete_file(self, version, file_id):
        """ Delete a file from the database.
        
            version -- The latest version of the box
            file_id -- The file ID to delete
        """
        self._debug("Called API: delete with version: {0}, file_id: {1}".format(version, file_id))

        url = "{0}/files".format(self.base)
        values = {"id": file_id, "version": version}
        return self._get(url, values, method = "DELETE")

    @require_token
    def get_file(self, file_id):
        """ Get the latest version of a file from the database.
        
            file_id -- The file ID to retrieve
        """
        logging.debug("Called API: get_file with file_id: {0}".format(file_id))

        url = "{0}/files".format(self.base)
        params = {'id': file_id}
        return self._get(url, params, raw = True)

    @require_token
    def list_files(self):
        """ Get a list of the files in the latest version of the box. """
        logging.debug("Called API: list_files")

        url = "{0}/files".format(self.base)
        return self._get(url)


#    @require_token
#    def listen(self):
#        """ Listen to updates to the database (locally, not with HTTP) and print out the diff in realtime. """
#        self.check_args(['box', 'username', 'password'])
#
#        def observer(notify):
#            print "Version updated to: {0}".format(notify.payload)
#
#        def err_cb(failure):
#            logging.error("Error in test listen: {0}".format(failure))
#            reactor.stop()
#
#        def connected_cb(conn):
#            print "Listening..."
#            conns = {"conn": conn}
#            store = ObjectStoreAsync(conns, self.args['username'], self.appid, "127.0.0.1") # TODO get the IP a better way? does it matter here?
#            store.listen(observer)
#
#        d = database.connect_box_raw(self.args['box'], self.args['username'], self.args['password'])
#        d.addCallbacks(connected_cb, err_cb)
#        reactor.run()

