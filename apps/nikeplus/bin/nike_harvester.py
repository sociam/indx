import logging, json, argparse, sys, os, uuid, urllib2
import logging.config
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
import oauth2 as oauth
from time import sleep
from datetime import date, datetime, timedelta, time
from nikeplus import NikePlus

class NikeHarvester:

    def __init__(self):
        logging.basicConfig(filename="nike_harvester.log", level=logging.DEBUG)
    
        data_root = keyring.util.platform_.data_root()
        if not os.path.exists(data_root):
            os.mkdir(data_root)
        keyring.set_keyring(PlaintextKeyring())

        self.parser = argparse.ArgumentParser(prog="run")
        self.parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
        self.parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
        self.parser.add_argument('--server', help="The server URL to connect to.")

        self.nike = NikePlus()

        self.version = 0

        self.harvester_id = "nikeplus_harvester"
        self.steps_ts_id = "nikeplus_steps_ts"
        self.calories_ts_id = "nikeplus_calories_ts"
        self.distance_ts_id = "nikeplus_distance_ts"
        self.fuel_ts_id = "nikeplus_fuel_ts"

    def set_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        if stored_config_harvester is not None:
            stored_config_harvester = json.loads(stored_config_harvester)
        stored_config_nike = keyring.get_password("Nike.com", "Nike+")
        if stored_config_nike is not None:
            stored_config_nike = json.loads(stored_config_nike)

        received_config = json.loads(args['config'])
        if (type(received_config) != dict):
            received_config = json.loads(received_config)
        logging.debug("Received config: {0}".format(received_config))
        if 'nike' in received_config:
            nike_config = received_config['nike']
            if nike_config and ('user' in nike_config) and ('password' in nike_config): 
                logging.debug("Received user: {0} and password: {1}".format(nike_config['user'], nike_config['password']))
                try:
                    self.nike.login(nike_config['user'], nike_config['password'])
                    logging.debug("Logged in with username {0} and password {1}".format(nike_config['user'], nike_config['password']))
                    token = self.nike.get_token()
                    logging.debug("Got token {0}".format(token))
                    if token:
                        nike_config['token'] = token
                        if 'error' in nike_config:
                            del nike_config['error']
                except Exception as exc:
                    logging.error("Could not authorise to Nike, with username {0} and password {1},  error: {2}".format(nike_config['user'], nike_config['password'], exc))
                    nike_config['error'] = str(exc)
                    del nike_config['password']
                keyring.set_password("Nike.com", "Nike+", json.dumps(nike_config))
        if 'harvester' in received_config:
            harvester_config = received_config['harvester']
            if harvester_config != stored_config_harvester:
                keyring.set_password("INDX", "INDX_Nike_Harvester", json.dumps(harvester_config)) 

    def get_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        stored_config_nike = keyring.get_password("Nike.com", "Nike+")

        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        logging.debug("Loaded nike config from keyring: {0}".format(stored_config_nike))

        if stored_config_nike is not None :
            if stored_config_harvester is None :
                return json.dumps({"nike":json.loads(stored_config_nike)}) 
            return json.dumps({"nike":json.loads(stored_config_nike), "harvester":json.loads(stored_config_harvester)}) 
        if stored_config_harvester is not None :
            return json.dumps({"harvester":json.loads(stored_config_harvester)}) 
        return json.dumps({})

    def check_configuration(self):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        logging.debug("stored_config_harvester type: {0}".format(type(stored_config_harvester)))
        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        if stored_config_harvester is None :
            logging.error("Harvester not configured. Please configure before use.")
            sys.exit(1)
        if (type(stored_config_harvester) != dict):
            stored_config_harvester = json.loads(stored_config_harvester)
            logging.debug("stored_config_harvester type (after 1 loads): {0}".format(type(stored_config_harvester)))

        stored_config_nike = keyring.get_password("Nike.com", "Nike+")
        logging.debug("stored_config_nike type: {0}".format(type(stored_config_nike)))
        logging.debug("Loaded nike config from keyring: {0}".format(stored_config_nike))

        if stored_config_nike is None :
            logging.error("No credentials for Nike.com. Please configure before use.")
            sys.exit(1)
        else :
            if (type(stored_config_nike) != dict):
                stored_config_nike = json.loads(stored_config_nike)
                logging.debug("stored_config_nike type (after 1 loads): {0}".format(type(stored_config_nike)))
            if ('password' in stored_config_nike) and ('user' in stored_config_nike):
                try:
                    self.nike.login(stored_config_nike['user'], stored_config_nike['password'])
                    logging.debug("Logged in with username {0} and password {1}".format(stored_config_nike['user'], stored_config_nike['password']))
                    token = self.nike.get_token()
                    logging.debug("Got token {0}".format(token))
                except Exception as exc: 
                    logging.error("Could not authorise to nike, error: {0}".format(exc))
                    sys.exit(1)

        return stored_config_harvester['box'], stored_config_harvester['user'], stored_config_harvester['password'], stored_config_harvester['overwrite']

    def run(self):
        args = vars(self.parser.parse_args())
        logging.debug("Received arguments: {0}".format(args))
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            logging.debug("Starting the harvester. ")
            self.work(args['server'])

    def yesterday(self):
        return datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(00,00,00))

    def today(self):
        return datetime.combine(datetime.now().date(), time(00,00,00))

    def get_indx(self, server_url, box, user, password):
        return_d = Deferred()
        def authed_cb(): 
            def token_cb(token):
                indx = IndxClient(server_url, box, appid, token = token)
                return_d.callback(indx)

            authclient.get_token(box).addCallbacks(token_cb, return_d.errback)
            
        authclient = IndxClientAuth(server_url, "INDX_Nike_Harvester")
        authclient.auth_plain(user, password).addCallbacks(lambda response: authed_cb(), return_d.errback)
        return return_d

    def work(self, server_url):
        box, user, password, overwrite = self.check_configuration()

        def indx_cb(indx):
            logging.debug("Created INDXClient.")

            # harvester = self.find_create(indx, self.harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Nike Harvester extra info"})
            # if harvester :
            #     if "zeros_from" in harvester :
            #         all_zeros_from = datetime.strptime(harvester["zeros_from"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
            #         if day < all_zeros_from :
            #             if overwrite :
            #                 harvester["zeros_from"] = day.isoformat()
            #     else :
            #         harvester["zeros_from"] = day.isoformat()
            # self.safe_update(indx, harvester)

            # self.harvest(indx)

        while 1: 
            self.get_indx(server_url, box, user, password).addCallbacks(indx_cb, lambda failure: logging.error("Error: {0}".format(failure)))
            logging.debug("Harvested! Suspending execution for 1 hour at {0}.".format(datetime.now().isoformat()))
            sleep(3600)
            overwrite = false; # will only overwrite the first time if the flag is set


if __name__ == '__main__':
    harvester = NikeHarvester()
    harvester.run();
