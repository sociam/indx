import argparse, getpass, logging, pprint, urllib2, sys, json, string
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from twisted.internet import reactor

""" A simple command-line client to import data in a box. """

logging.basicConfig(level = logging.DEBUG)

parser = argparse.ArgumentParser(description = "Import to a box.")
parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
parser.add_argument('user', type=str, help="INDX username, e.g. indx")
parser.add_argument('password', type=str, help="INDX password, e.g. indx")
parser.add_argument('box', type=str, help="Box to import the objects to")
parser.add_argument('file', type=str, help="File name for the input data")
parser.add_argument('--debug', default=False, action="store_true", help="Enable debugging")

args = vars(parser.parse_args())

if args['debug']:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

def get_indx(server_url, box, user, password):
    indx_d = Deferred()

    def authed_cb(resp): 
        logging.debug("authentication response: {0}".format(resp))
        logging.debug("authenticated, getting the indx client token");

        def token_cb(token):
            indx = IndxClient(server_url, box, "Slicer", token = token, client = authclient.client)
            logging.debug("Got the indx client token");
            indx_d.callback(indx)

        authclient.get_token(box).addCallbacks(token_cb, indx_d.errback)
        
    logging.debug("creating authclient")
    authclient = IndxClientAuth(server_url, "Slicer")
    logging.debug("authclient authenticate (plain)")
    authclient.auth_plain(user, password).addCallbacks(authed_cb, indx_d.errback)
    return indx_d

def read_from_file(f):
    inf=open(f, 'r') 
    data = json.load(inf)
    inf.close()
    return data

def safe_update(indx, vers, obj) :
    logging.debug("Updating objects at box version {0}".format(vers))
    update_d = Deferred()

    def update_cb(resp):
        logging.debug("safe_update: received response: {0}".format(resp))
        if resp and "code" in resp and "data" in resp:
            if resp["code"] == 201 or resp["code"] == 200:
                box_version = resp["data"]["@version"]
                logging.debug("Updated objects! new box version: {0}".format(box_version))
                update_d.callback(box_version)
            else:
                logging.debug("Received unknown response code {0}".format(resp))
                update_d.errback(resp)
        else:
            logging.debug("Received unknown or no response {0}".format(resp))
            update_d.errback(resp)

    def exception_cb(e, obj=obj, indx=indx):
        logging.error("Exception in safe update: {0}".format(e))
        if isinstance(e.value, urllib2.HTTPError): # handle a version incorrect error, and update the version
            if e.value.code == 409: # 409 Obsolete
                response = e.value.read()
                json_response = json.loads(response)
                box_version = json_response['@version']
                indx.update(box_version, obj).addCallbacks(update_cb, exception_cb)
            else:
                logging.error("HTTPError updating INDX: {0}".format(e.value))
                update_d.errback(e.value)
        else:
            logging.error("Error updating INDX: {0}".format(e.value))
            update_d.errback(e.value)

    indx.update(vers, obj).addCallbacks(update_cb, exception_cb)
    return update_d


def indx_cb(indx):
    logging.debug("got the indx client, trying to import");
    data = read_from_file(args['file'])

    def insert_cb(v, i, data=data, indx=indx):
        if i<len(data):
            chunk = data[i:i+1000]
            safe_update(indx, v, chunk).addCallbacks(insert_cb, lambda failure: logging.error("Error updating INDX: {0}".format(failure)), callbackArgs=[i+1000])
        else:
            reactor.stop()
            return 0;

    i = 0
    insert_cb(0, i, data, indx)

get_indx(args['address'], args['box'], args['user'], args['password']).addCallbacks(indx_cb, lambda failure: logging.error("Error: {0}".format(failure)))
reactor.run()