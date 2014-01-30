import argparse, getpass, logging, pprint, urllib2, sys, json, string
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from twisted.internet import reactor

""" A simple command-line client to run a query on the contents of a box. """

logging.basicConfig(level = logging.DEBUG)

parser = argparse.ArgumentParser(description = "Run a query on a box.")
parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
parser.add_argument('user', type=str, help="INDX username, e.g. indx")
parser.add_argument('password', type=str, help="INDX password, e.g. indx")
parser.add_argument('box', type=str, help="Box to query")
parser.add_argument('outfile', type=str, help="File name for the output")
parser.add_argument('query', type = str, help = "The query to run")
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

# def filter():
    # week1 = []
    # week2 = []
    # for dp_id in data:
    #     dp = data[dp_id]
    #     if string.find(dp['start'][0]['@value'],'2013-08-') > -1:
    #         if ((string.find(dp['start'][0]['@value'],'2013-08-12') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-13') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-14') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-15') > -1) or
    #             (string.find(dp['start'][0]['@value'],'2013-08-16') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-17') > -1) or
    #             (string.find(dp['start'][0]['@value'],'2013-08-18') > -1)) :
    #             week1.append(dp)
    #         if ((string.find(dp['start'][0]['@value'],'2013-08-19') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-20') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-21') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-22') > -1) or
    #             (string.find(dp['start'][0]['@value'],'2013-08-23') > -1) or 
    #             (string.find(dp['start'][0]['@value'],'2013-08-24') > -1) or
    #             (string.find(dp['start'][0]['@value'],'2013-08-25') > -1)) :
    #             week2.append(dp)
    # logging.debug(len(week1))
    # logging.debug(len(week2))
    # w1 = open("week1.json", 'a+')
    # w1.write(pprint.pformat(week1, indent=2))
    # w1.flush()
    # w1.close()
    # w2 = open("week2.json", 'a+')
    # w2.write(pprint.pformat(week2, indent=2))
    # w2.flush()
    # w2.close()

def save_to_file(data, f):
    outf=open(f, 'a+') 
    json.dump(data, outf, indent=2)

def indx_cb(indx):
    logging.debug("got the indx client, trying the query: {0}".format(args['query']));

    def query_cb(resp):
        data = resp['data']
        save_to_file(data, args['outfile'])
        reactor.stop()
        return 0;

    indx.query(args['query'], depth=0).addCallbacks(query_cb, lambda failure: logging.error("Error querying INDX: {0}".format(failure)))

get_indx(args['address'], args['box'], args['user'], args['password']).addCallbacks(indx_cb, lambda failure: logging.error("Error: {0}".format(failure)))
reactor.run()