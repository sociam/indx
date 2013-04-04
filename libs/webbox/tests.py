#    This file is part of WebBox.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
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

import urllib, urllib2, logging, cookielib, json, pprint
from webbox.objectstore_async import ObjectStoreAsync
import webbox.webbox_pg2 as database
from twisted.internet import reactor

class WebBoxTests:

    def __init__(self, appid="WebBoxTests"):
        """ Associate command-line test names with test functions. """
        self.tests = {'create_box': self.create_box,
                      'list_boxes': self.list_boxes,
                      'get_object_ids': self.get_object_ids,
                      'get_latest': self.get_latest,
                      'diff': self.diff,
                      'update': self.update,
                      'delete': self.delete,
                      'query': self.query,
                      'get_by_ids': self.get_by_ids,
                      'listen': self.listen
                     }

        self.token = None
        self.appid = appid

        """ Set up a cookies-enabled opener globally. """
        cj = cookielib.LWPCookieJar()
        opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cj))
        urllib2.install_opener(opener)


    def set_args(self, args):
        """ Move relevant command-line arguments into local variable. """
        self.args = args

        """ Flatten single value lists into flat key/value pair. """
        for key in args:
            if type(args[key]) == type([]) and len(args[key]) == 1:
                args[key] = args[key][0]

        """ Ensure self.server always ends in a / """
        if self.args['server'][-1:] != "/":
            self.args['server'] += "/"


    """ Shared functions. """

    def check_args(self, required):
        not_set = []
        for key in required:
            if key not in self.args or self.args[key] is None or self.args[key] == "":
                not_set.append(key)
        
        if len(not_set) > 0:
            raise Exception("The following values cannot be empty for this test: {0}".format(", ".join(not_set)))

    def get(self, url, values):
        """ Do a GET, decode the result JSON and return it. """

        our_values = {}
        if 'box' in self.args:
            our_values['box'] = self.args['box']
        our_values['app'] = self.appid

        if self.token is not None:
            our_values['token'] = self.token

        data = urllib.urlencode(our_values)
        url += "?" + data

        # encode separately, because it might be a list of tuples, not a dict
        if values is not None and len(values) > 0:
            url += "&" + urllib.urlencode(values)

        logging.debug("GET on url: {0}".format(url))

        req = urllib2.Request(url)
        response = urllib2.urlopen(req)
        the_page = response.read()

        logging.debug("GET raw results: \n{0}\n".format(the_page))

        status = json.loads(the_page)
        return status


    def req_body(self, url, values, method, content_type):
        """ Do an HTTP request with arguments in the body (POST/PUT/DELETE etc), using the specified method.
        """
        if values is None:
            values = {}
        if 'box' in self.args:
            values['box'] = self.args['box']
        values['app'] = self.appid

        if self.token is not None:
            values['token'] = self.token

        logging.debug("Sending request to {0} with body {1}".format(url, values))

        data = urllib.urlencode(values)
        req = urllib2.Request(url, data)
        req.add_header("Content-Type", content_type)
        req.get_method = lambda: method
        response = urllib2.urlopen(req)
        the_page = response.read()

        logging.debug("Request ({1}) raw results: \n{0}\n".format(the_page, method))

        status = json.loads(the_page)
        return status


    def delete_(self, url, values, content_type="application/json"):
        """ Do a DELETE, decode the result JSON and return it.
        """
        return self.req_body(url, values, "DELETE", content_type)


    def put(self, url, values, content_type="application/json"):
        """ Do a PUT, decode the result JSON and return it.
        """
        return self.req_body(url, values, "PUT", content_type)


    def post(self, url, values, content_type="application/json"):
        """ Do a POST, decode the result JSON and return it. """
        return self.req_body(url, values, "POST", content_type)


    def auth(self):
        """ Authenticate to the webbox server. """
        self.check_args(['server','username','password'])
        url = "{0}auth/login".format(self.args['server'])
        values = {"username": self.args['username'], "password": self.args['password']}

        logging.debug("Authentication to URL: {0} with data: {1}".format(url, values))
        status = self.post(url, values)

        if status['code'] != 200:
            raise Exception("Authentication failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            logging.info("Authentication successful.")

    
    def get_token(self):
        """ Get a token for this box. """
        self.check_args(['server','box'])
        url = "{0}auth/get_token".format(self.args['server'])
        values = {"box": self.args['box'], "app": self.appid}

        logging.debug("Get token of box '{0}' to URL: {1}".format(self.args['box'], url))
        status = self.post(url, values)

        if status['code'] != 200:
            raise Exception("Getting a token to box '{0}' failed, response is {1} with code {2}".format(self.args['box'], status['message'], status['code']))
        else:
            self.token = status['token']


    """ Test functions."""

    def create_box(self):
        """ Test to create a box. """
        self.check_args(['server','box'])
        self.auth()

        url = "{0}admin/create_box".format(self.args['server'])
        values = {"name": self.args['box']}

        logging.debug("Creating box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        status = self.post(url, values)

        if not (status['code'] != 200 or status['code'] != 201):
            raise Exception("Box creation failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Creation of box successful, return is: {0}".format(pretty))

    def list_boxes(self):
        """ List the boxes on the webbox server. """
        self.check_args(['server'])
        self.auth()

        url = "{0}admin/list_boxes".format(self.args['server'])

        logging.debug("Listing boxes on server '{0}'".format(self.args['server']))
        status = self.get(url, None)

        if status['code'] != 200:
            raise Exception("Listing boxes failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Listing of boxes successful, return is: {0}".format(pretty))

    def get_object_ids(self):
        """ Get the IDs of every object in this box. """
        self.check_args(['server', 'box'])
        self.auth()
        self.get_token()

        url = "{0}{1}/get_object_ids".format(self.args['server'], self.args['box'])

        logging.debug("Getting a list of object IDs on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        status = self.get(url, None)

        if status['code'] != 200:
            raise Exception("Listing object IDs failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Listing of objects successful, return is: {0}".format(pretty))


    def update(self):
        """ Test to update objects in a box. """
        self.check_args(['server','box','data','version'])
        self.auth()
        self.get_token()

        url = "{0}{1}".format(self.args['server'], self.args['box'])
        values = {"data": self.args['data'].read(), "version": self.args['version'], "box": self.args['box'], "app": self.appid}

        logging.debug("Updating data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        status = self.put(url, values)
        if status['code'] != 201:
            raise Exception("Updating box {0} failed. Response is {1} with code {2}".format(self.args['box'], status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Update on box {0} sucessful, return is: {1}".format(self.args['box'], pretty))


    def delete(self):
        """ Test to delete objects from a box.
        
            'query' argument should be a JSON string of an array of object IDs.
            e.g., query="['id1','id2','id3']"
        """
        self.check_args(['server','box','query','version'])
        self.auth()
        self.get_token()

        url = "{0}{1}".format(self.args['server'], self.args['box'])
        values = {"data": self.args['query'], "version": self.args['version'], "box": self.args['box'], "app": self.appid}

        logging.debug("Deleting data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        status = self.delete_(url, values)
        if status['code'] != 201:
            raise Exception("Deleting from box {0} failed. Response is {1} with code {2}".format(self.args['box'], status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Delete from box {0} sucessful, return is: {1}".format(self.args['box'], pretty))
            

    def get_latest(self):
        """ Get the latest version of every object in this box. """
        self.check_args(['server', 'box'])
        self.auth()
        self.get_token()

        url = "{0}{1}".format(self.args['server'], self.args['box'])

        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        status = self.get(url, None)

        if status['code'] != 200:
            raise Exception("Getting latest failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Getting latest successful, the objects are: \n" + pretty)
        

    def get_by_ids(self):
        """ Get the latest version of specific objects in this box. """
        self.check_args(['server', 'box', 'id'])
        self.auth()
        self.get_token()

        url = "{0}{1}".format(self.args['server'], self.args['box'])

        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))

        id_list = self.args['id']
        if type(id_list) != type([]):
            id_list = [id_list]

        id_tuples = []
        for id in id_list:
            id_tuples.append( ("id", id) )

        status = self.get(url, id_tuples)

        if status['code'] != 200:
            raise Exception("Getting by IDs failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Getting latest by IDs successful, the objects are: \n" + pretty)
    

    def query(self):
        """ 
           Query this box.
             e.g., query="{ '@id': 2983 }"
             or query="{ 'firstname': 'dan' }"           
        """
        self.check_args(['server', 'box', 'query'])
        self.auth()
        self.get_token()

        url = "{0}{1}/query".format(self.args['server'], self.args['box'])

        logging.debug("Querying server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        status = self.get(url, {'q': self.args['query']})

        if status['code'] != 200:
            raise Exception("Querying failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Querying successful, the objects are: \n" + pretty)


    def diff(self):
        """ Query this box. """
        self.check_args(['server', 'box', 'from', 'return_objs'])
        self.auth()
        self.get_token()

        url = "{0}{1}/diff".format(self.args['server'], self.args['box'])

        logging.debug("Calling diff on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))

        params = {'from_version': self.args['from']}

        # to_version is optional
        if "to" in self.args and self.args['to'] is not None:
            params['to_version'] = self.args['to']

        params['return_objs'] = self.args['return_objs']
        status = self.get(url, params)

        if status['code'] != 200:
            raise Exception("Diff failed, response is {0} with code {1}".format(status['message'], status['code']))
        else:
            pretty = pprint.pformat(status, indent=2, width=80)
            logging.info("Diff successful, return is: \n" + pretty)


    def listen(self):
        """ Listen to updates to the database (locally, not with HTTP) and print out the diff in realtime. """
        self.check_args(['box', 'username', 'password'])

        def observer(notify):
            print "Version updated to: {0}".format(notify.payload)

        def err_cb(failure):
            logging.error("Error in test listen: {0}".format(failure))

        def connected_cb(conn):
            print "Listening..."
            store = ObjectStoreAsync(conn, self.args['username'], self.appid, "127.0.0.1") # TODO get the IP a better way? does it matter here?
            store.listen(observer)

        d = database.connect_box_raw(self.args['box'], self.args['username'], self.args['password'])
        d.addCallbacks(connected_cb, err_cb)
        reactor.run()

