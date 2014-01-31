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

import traceback
import argparse
import logging
import pprint
import json
import cjson
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from twisted.internet import reactor

class CLIClient:

    def __init__(self, appid = "INDX CLIClient"):
        """ Associate command-line actions with functions, and enforce required variables. """
        self.actions = {'create_box': {'f': self.create_box, 'args': ['box']},
                      'delete_box': {'f': self.delete_box, 'args': ['box']},
                      'list_boxes': {'f': self.list_boxes, 'args': []},
                      'get_object_ids': {'f': self.get_object_ids, 'args': ['box']},
                      'create_user': {'f': self.create_user, 'args': ['target_username','target_password']},
                      'update': {'f': self.update, 'args': ['box','data','version']},
                      'delete': {'f': self.delete, 'args': ['box','id','version']},
                      'get_latest': {'f': self.get_latest, 'args': ['box']},
                      'get_by_ids': {'f': self.get_by_ids, 'args': ['box','id']},
                      'query': {'f': self.query, 'args': ['box','query']},
                      'diff': {'f': self.diff, 'args': ['box','from','return_objs']},
                      #'listen': {'f': self.listen, 'args': ['box']},
                      'add_file': {'f': self.add_file, 'args': ['box','data','id','version','contenttype']},
                      'delete_file': {'f': self.delete_file, 'args': ['box','id','version']},
                      'get_file': {'f': self.get_file, 'args': ['box','id']},
                      'list_files': {'f': self.list_files, 'args': ['box']},
                      'set_acl': {'f': self.set_acl, 'args': ['box','acl','target_username']},
                      'get_acls': {'f': self.get_acls, 'args': ['box']},
                      'generate_new_key': {'f': self.generate_new_key, 'args': ['box']},
                      'create_root_box': {'f': self.create_root_box, 'args': ['box']},
                      'link_remote_box': {'f': self.link_remote_box, 'args': ['box', 'remote_token', 'remote_box', 'remote_address']},
                      'generate_token': {'f': self.generate_token, 'args': ['box']},
                     }

        self.token = None
        self.appid = appid
        self.indx = None


    def set_args(self, args):
        """ Move relevant command-line arguments into local variable. """
        logging.debug("Set args: {0}".format(args))
        self.args = args

        """ Flatten single value lists into flat key/value pair. """
        for key in args:
            if type(args[key]) == type([]) and len(args[key]) == 1:
                args[key] = args[key][0]

        """ Ensure self.server always ends in a / """
        if self.args['server'][-1:] != "/":
            self.args['server'] += "/"


    def check_args(self, required):
        not_set = []
        for key in required:
            if key not in self.args or self.args[key] is None or self.args[key] == "":
                not_set.append(key)
       
        if not self.args['allowempty'] and len(not_set) > 0:
            raise Exception("The following values cannot be empty for this action: {0}".format(", ".join(not_set)))

    def auth_and_get_token(self, get_token):
        """ Authenticate, get a token and call it back to the deferred. """
        return_d = Deferred()

        def authed_cb(): 
            def token_cb(token):
                if token is not None:
                    self.token = token
                    return_d.callback(token)
                else:
                    return_d.callback(None)

            if get_token:
                authclient.get_token(self.args['box']).addCallbacks(token_cb, return_d.errback)
            else:
                token_cb(None)
            
        authclient = IndxClientAuth(self.args['server'], self.appid)
        self.client = authclient.client
        authclient.auth_plain(self.args['username'], self.args['password']).addCallbacks(lambda response: authed_cb(), return_d.errback)

        return return_d

    def call_action(self, name, *args, **kwargs):
        """ Calls an action by name. """
        return_d = Deferred()

        action = self.actions[name]
        f = action['f']
        self.check_args(action['args'])

        def do_call():
            f(*args, **kwargs).addCallbacks(lambda status: return_d.callback(self.parse_status(name, status)), return_d.errback)

        if not self.token:
            def token_cb(token):
                if not self.indx:
                    self.indx = IndxClient(self.args['server'], self.args['box'], self.appid, token = token, client = self.client)
                do_call()

            self.auth_and_get_token(IndxClient.requires_token(f)).addCallbacks(token_cb, return_d.errback)
        else:
            do_call()
            
        return return_d


    def parse_status(self, source, status):
        """ Parse the status returned from the server, and raise an Exception if necessary. """

        if status is not None: # status is None when a file has been printed raw
            if status['code'] < 200 or status['code'] > 299:
                raise Exception("{0} in box {1} failed. Response is {2} with code {3}".format(source, self.args['box'], status['message'], status['code']))
            else:
                if "data" in status and self.args['jsondata']:
                    return json.dumps(status['data'], indent = 2)
                else:
                    pretty = pprint.pformat(status, indent=2, width=80)
                    logging.info("{0} in box {1} successful, return is: {2}".format(source, self.args['box'], pretty))
                    return None


    """ Test functions."""

    def create_box(self):
        """ Test to create a box. """
        logging.debug("Creating box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.indx.create_box()

    def delete_box(self):
        """ Test to delete a box. """
        logging.debug("Deleting box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.indx.delete_box()

    def list_boxes(self):
        """ List the boxes on the INDX server. """
        logging.debug("Listing boxes on server '{0}'".format(self.args['server']))
        return self.indx.list_boxes()


    def get_object_ids(self):
        """ Get the IDs of every object in this box. """
        logging.debug("Getting a list of object IDs on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.get_object_ids()


    def update(self):
        """ Test to update objects in a box. """
        logging.debug("Updating data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        #return self.indx.update(self.args['version'], cjson.decode(self.args['data'].read()), all_unicode=True)
        return self.indx.update(self.args['version'], json.loads(self.args['data'].read()))


    def delete(self):
        """ Test to delete objects from a box.
        
            'id' argument should be a list of ids
            e.g., --id=id1 --id=id2
        """
        logging.debug("Deleting data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.indx.delete(self.args['version'], self.args['id'])


    def get_latest(self):
        """ Get the latest version of every object in this box. """
        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.get_latest()


    def get_by_ids(self):
        """ Get the latest version of specific objects in this box. """
        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        ids = self.args['id']
        if type(ids) != type([]):
            ids = [ids] # put a single id into an array
        return self.indx.get_by_ids(ids)


    def query(self):
        """ Query this box.
             e.g., query="{ '@id': 2983 }"
             or query="{ 'firstname': 'dan' }"           
        """
        logging.debug("Querying server '{0}' in box '{1}' with depth '{2}'".format(self.args['server'], self.args['box'], self.args['depth']))
        return self.indx.query(self.args['query'], depth = int(self.args['depth']))


    def diff(self):
        """ Run a diff of two version of this box. """
        logging.debug("Calling diff on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))

        to_version = None
        if "to" in self.args and self.args['to'] is not None:
            to_version = self.args['to']

        return self.indx.diff(self.args['return_objs'], self.args['from'], to_version = to_version)


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


    def add_file(self):
        """ Add a file to the database. """
        logging.debug("Adding a file to server '{0}' in box '{1}', with id: {2}".format(self.args['server'], self.args['box'], self.args['id']))
        return self.indx.add_file(self.args['version'], self.args['id'], self.args['data'].read(), self.args['contenttype'])


    def delete_file(self):
        """ Delete a file from the database. """
        logging.debug("Deleting a file from server '{0}' in box '{1}', with id: {2}".format(self.args['server'], self.args['box'], self.args['id']))
        return self.indx.delete_file(self.args['version'], self.args['id'])


    def get_file(self):
        """ Get a file from the database. """
        logging.debug("Calling get_file on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        # returns the file to stdout so it can be piped to a file
        print self.indx.get_file(self.args['id'])


    def list_files(self):
        """ Get a list of the files from the database. """
        logging.debug("Calling list_files on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.list_files()

    def set_acl(self):
        """ Set an ACL for a target user for a database. """
        logging.debug("Calling set_acl on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.set_acl(self.args['acl'], self.args['target_username'])

    def get_acls(self):
        """ Get ACLs for a database. """
        logging.debug("Calling get_acls on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.get_acls()

    def generate_new_key(self):
        """ Generate and store a new key, returning the public and public-hash parts of the key. """
        logging.debug("Calling generate_new_key on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.generate_new_key()

    def create_root_box(self):
        """ Create root box for a user. """
        logging.debug("Calling create_root_box on server '{0}' for box '{1}'".format(self.args['server'], self.args['box']))
        return self.indx.create_root_box(self.args['box'])

    def create_user(self):
        """ Create a new user. """
        logging.debug("Calling create_user on server '{0}' with target username '{1}'".format(self.args['server'], self.args['target_username']))
        return self.indx.create_user(self.args['target_username'], self.args['target_password'])

    def link_remote_box(self):
        """ Link a remote box with a local box. """
        logging.debug("Calling link_remote_box on remote_address '{0}', remote_box '{1}', remote_token '{2}'".format(self.args['remote_address'], self.args['remote_box'], self.args['remote_token']))
        return self.indx.link_remote_box(self.args['remote_address'], self.args['remote_box'], self.args['remote_token'])

    def generate_token(self):
        """ Generate a token for this box, and print it. """
        logging.debug("Calling generate_token on box {0}.".format(self.args['box']))
        return_d = Deferred()
        def token_cb(token):
            return_d.callback({"code": 200, "data": token})
        self.auth_and_get_token(True).addCallbacks(token_cb, return_d.errback)
        return return_d


if __name__ == "__main__":
    client = CLIClient()

    parser = argparse.ArgumentParser(description='Access an INDX server.')
    parser.add_argument('server', metavar='SERVER', type=str, nargs=1, help='URL of INDX server, e.g. http://localhost:8211/')
    parser.add_argument('username', metavar='USERNAME', type=str, nargs=1, help='Username')
    parser.add_argument('password', metavar='PASSWORD', type=str, nargs=1, help='Password')
    parser.add_argument('action', metavar='ACTION', type=str, nargs=1, choices=client.actions.keys(), help='Run a named action, one of: '+", ".join(client.actions.keys()))
    parser.add_argument('--box', action="store", type=str, help='Name of the Box (for actions that required it)')
    parser.add_argument('--query', action="store", type=str, help='Query string (for actions that required it)')
    parser.add_argument('--depth', action="store", default="3", type=int, help='Depth of returned answer, how deep in the object hierarchy to return (e.g. for query)')
    parser.add_argument('--data', action="store", type=argparse.FileType('r'), help="Data file (e.g., JSON to import)")
    parser.add_argument('--version', action="store", help="Current version of the box (or 0 if the box is empty)")
    parser.add_argument('--from', action="store", help="From version (e.g., for 'diff')")
    parser.add_argument('--to', action="store", help="To version (e.g., for 'diff')")
    parser.add_argument('--return_objs', action="store", default="ids", help="Enable return of 'objects', 'ids', 'diff' (e.g., for 'diff')")
    parser.add_argument('--debug', action="store_true", default=False, help="Enable output of debug logging")
    parser.add_argument('--id', action="store", nargs="+", help="Limit to specific IDs (e.g., for get_by_ids)")
    parser.add_argument('--contenttype', action="store", help="Specify content-type (e.g., for add_file)")
    parser.add_argument('--jsondata', action="store_true", default=False, help="Return the 'data' element of the response as JSON.")
    parser.add_argument('--allowempty', action="store_true", default=False, help="Allow empty values e.g. for the 'query' value (for testing the server).")
    parser.add_argument('--acl', action="store", type=str, help='Access Control List (ACL) in JSON format, must have "read", "write" and "control" keys, all with boolean values, e.g. {"read": true, "write": true", "control": false}')
    parser.add_argument('--target_username', action="store", type=str, help='Target username, e.g. when creating a new user, or for setting ACLs for')
    parser.add_argument('--target_password', action="store", type=str, help='Target password, e.g. when creating a new user')
    parser.add_argument('--remote_address', action="store", type=str, help='Remote INDX address, e.g. when linking remote boxes')
    parser.add_argument('--remote_box', action="store", type=str, help='Remote box, e.g. when linking remote boxes')
    parser.add_argument('--remote_token', action="store", type=str, help='Remote INDX auth token, e.g. when linking remote boxes')

    args = vars(parser.parse_args())

    if args['debug']:
        logging.basicConfig(level='DEBUG')
    else:
        logging.basicConfig(level='INFO')

    def err_cb(failure):
        failure.trap(Exception)
        logging.error("Error: {0}".format(failure))
        if args['debug']:
            traceback.print_exc()
        if reactor.running:
            reactor.stop()

    try:
        action = args['action'][0]
        client.set_args(args)

        def responded_cb(response):
            if response is not None:
                print response
            reactor.stop()

        client.call_action(action).addCallbacks(responded_cb, err_cb)
        reactor.run()
    except Exception as e:
        err_cb(Failure(e))

