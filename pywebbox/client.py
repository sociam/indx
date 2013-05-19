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
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import traceback, argparse, logging, pprint, json
from pywebbox import WebBox

class WebBoxClient:

    def __init__(self, appid = "WebBoxClient"):
        """ Associate command-line actions with functions, and enforce required variables. """
        self.actions = {'create_box': {'f': self.create_box, 'args': ['box']},
                      'list_boxes': {'f': self.list_boxes, 'args': []},
                      'get_object_ids': {'f': self.get_object_ids, 'args': ['box']},
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
                     }

        self.appid = appid
        self.webbox = None


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
        
        if len(not_set) > 0:
            raise Exception("The following values cannot be empty for this action: {0}".format(", ".join(not_set)))


    def call_action(self, name, *args, **kwargs):
        """ Calls an action by name. """

        action = self.actions[name]
        f = action['f']
        self.check_args(action['args'])

        if not self.webbox:
            self.webbox = WebBox(self.args['server'], self.args['box'], self.args['username'], self.args['password'], self.appid)

        return self.parse_status(name, f(*args, **kwargs))


    def parse_status(self, source, status):
        """ Parse the status returned from the server, and raise an Exception if necessary. """

        if status is not None: # status is None when a file has been printed raw
            if status['code'] < 200 or status['code'] > 299:
                raise Exception("{0} in box {1} failed. Response is {2} with code {3}".format(source, self.args['box'], status['message'], status['code']))
            else:
                if "data" in status and self.args['jsondata']:
                    print json.dumps(status['data'], indent = 2)
                else:
                    pretty = pprint.pformat(status, indent=2, width=80)
                    logging.info("{0} in box {1} successful, return is: {2}".format(source, self.args['box'], pretty))


    """ Test functions."""

    def create_box(self):
        """ Test to create a box. """
        logging.debug("Creating box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.webbox.create_box()


    def list_boxes(self):
        """ List the boxes on the webbox server. """
        logging.debug("Listing boxes on server '{0}'".format(self.args['server']))
        return self.webbox.list_boxes()


    def get_object_ids(self):
        """ Get the IDs of every object in this box. """
        logging.debug("Getting a list of object IDs on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.webbox.get_object_ids()


    def update(self):
        """ Test to update objects in a box. """
        logging.debug("Updating data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.webbox.update(self.args['version'], json.loads(self.args['data'].read()))


    def delete(self):
        """ Test to delete objects from a box.
        
            'id' argument should be a list of ids
            e.g., --id=id1 --id=id2
        """
        logging.debug("Deleting data to box: '{0}' on server '{1}'".format(self.args['box'], self.args['server']))
        return self.webbox.delete(self.args['version'], self.args['id'])


    def get_latest(self):
        """ Get the latest version of every object in this box. """
        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.webbox.get_latest()


    def get_by_ids(self):
        """ Get the latest version of specific objects in this box. """
        logging.debug("Getting latest objects on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        ids = self.args['id']
        if type(ids) != type([]):
            ids = [ids] # put a single id into an array
        return self.webbox.get_by_ids(ids)


    def query(self):
        """ Query this box.
             e.g., query="{ '@id': 2983 }"
             or query="{ 'firstname': 'dan' }"           
        """
        logging.debug("Querying server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.webbox.query(self.args['query'])


    def diff(self):
        """ Run a diff of two version of this box. """
        logging.debug("Calling diff on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))

        to_version = None
        if "to" in self.args and self.args['to'] is not None:
            to_version = self.args['to']

        return self.webbox.diff(self.args['return_objs'], self.args['from'], to_version = to_version)


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
        return self.webbox.add_file(self.args['version'], self.args['id'], self.args['data'].read(), self.args['contenttype'])


    def delete_file(self):
        """ Delete a file from the database. """
        logging.debug("Deleting a file from server '{0}' in box '{1}', with id: {2}".format(self.args['server'], self.args['box'], self.args['id']))
        return self.webbox.delete_file(self.args['version'], self.args['id'])


    def get_file(self):
        """ Get a file from the database. """
        logging.debug("Calling get_file on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        # returns the file to stdout so it can be piped to a file
        print self.webbox.get_file(self.args['id'])


    def list_files(self):
        """ Get a list of the files from the database. """
        logging.debug("Calling list_files on server '{0}' in box '{1}'".format(self.args['server'], self.args['box']))
        return self.webbox.list_files()


if __name__ == "__main__":
    wbclient = WebBoxClient()

    parser = argparse.ArgumentParser(description='Access a WebBox server.')
    parser.add_argument('server', metavar='SERVER', type=str, nargs=1, help='URL of WebBox server, e.g. http://localhost:8211/')
    parser.add_argument('username', metavar='USERNAME', type=str, nargs=1, help='Username')
    parser.add_argument('password', metavar='PASSWORD', type=str, nargs=1, help='Password')
    parser.add_argument('action', metavar='ACTION', type=str, nargs=1, choices=wbclient.actions.keys(), help='Run a named action, one of: '+", ".join(wbclient.actions.keys()))
    parser.add_argument('--box', action="store", type=str, help='Name of the Box (for actions that required it)')
    parser.add_argument('--query', action="store", type=str, help='Query string (for actions that required it)')
    parser.add_argument('--data', action="store", type=argparse.FileType('r'), help="Data file (e.g., JSON to import)")
    parser.add_argument('--version', action="store", help="Current version of the box (or 0 if the box is empty)")
    parser.add_argument('--from', action="store", help="From version (e.g., for 'diff')")
    parser.add_argument('--to', action="store", help="To version (e.g., for 'diff')")
    parser.add_argument('--return_objs', action="store", default="ids", help="Enable return of 'objects', 'ids', 'diff' (e.g., for 'diff')")
    parser.add_argument('--debug', action="store_true", default=False, help="Enable output of debug logging")
    parser.add_argument('--id', action="store", nargs="+", help="Limit to specific IDs (e.g., for get_by_ids)")
    parser.add_argument('--contenttype', action="store", help="Specify content-type (e.g., for add_file)")
    parser.add_argument('--jsondata', action="store_true", default=False, help="Return the 'data' element of the response as JSON.")

    args = vars(parser.parse_args())

    if args['debug']:
        logging.basicConfig(level='DEBUG')
    else:
        logging.basicConfig(level='INFO')

    try:
        action = args['action'][0]
        wbclient.set_args(args)
        wbclient.call_action(action)
    except Exception as e:
        if args['debug']:
            traceback.print_exc()
        print "There was a problem: {0}".format(e)

