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

import logging,json,argparse,sys,time,os,ast
import logging.config
import keyring
import keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from service_controller_facebook import FacebookServiceController


logging.basicConfig(level=logging.DEBUG)

config = {}

def parse_args():
    parser = argparse.ArgumentParser(prog="run")
    parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
    parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
    parser.add_argument('--server', help="The server URL to connect to.")
    parsed = parser.parse_args()
    args = vars(parser.parse_args())
    return args

def init():
    # some platforms have no data root. we can take care of them now.
    data_root = keyring.util.platform_.data_root()
    if not os.path.exists(data_root):
        os.mkdir(data_root)
    keyring.set_keyring(PlaintextKeyring())

def run(args):
    #print "RECEIVED RUN ARGS OF:"+str(args)
    if args['config']:
        #print(keyring.util.platform_.data_root())
        config = json.loads(args['config'])
        #config = ast.literal_eval(config)
        token_type = config['facebook_auth_status']

        if "Short" in token_type:
            #print "getting long token"
            service_controler = FacebookServiceController(config)
            config = service_controler.getAccesstokenConfig()
            #print "heres a new config file: "+str(config)            
            #logging.debug("received config: {0}".format(config))
            try:
                config = json.dumps(config)
                keyring.set_password("INDX", "INDX_Facebook_App", config)
                logging.debug('short token config added to keyring: {0}'.format(config))
            except:
                logging.debug('Facebook Run.py Error in getting Keyring {0}'.format(sys.exc_info()))
        else:
            #TODO - NEED TO PUT OTHER CASSE WHEN IT IS FULL CONFIG
            keyring.set_password("INDX", "INDX_Facebook_App", json.dumps(config))
            logging.debug('Full config added to keyring: {0}'.format(config))
    elif args['get_config']:
        # TODO output the stored config (for passing ti back to the server)
        print json.dumps(get_config(args));
    else:
        # print(keyring.util.platform_.data_root())
        config = keyring.get_password("INDX", "INDX_Facebook_App")
        #print "Didnt match any args value, working with config of: "+str(config)
        logging.debug("Facebook run.py - running the app with: {0}".format(config));
        config = json.loads(config)
        config['address'] = args['server']
        logging.debug("Facebook run.py - Adding INDX address to config, new config loaded: {0}".format(config));
        #test run with configs
        #twitter_service = TwitterService(config)

        #only proceed with run IF the long token has been acheived.
        token_type = config['facebook_auth_status']

        if "Long" in token_type:
            service_controler = FacebookServiceController(config)
            service_controler.load_service_instance()
            time.sleep(2)

def get_config(args):
    #print "Getting config from keychain..."
    stored_config = keyring.get_password("INDX", "INDX_Facebook_App")
    #if "box" in stored_config:
        #stored_config = json.dumps(stored_config)
    stored_config = ast.literal_eval(stored_config)
    return stored_config

    # keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
    # print keyring.get_password("INDX", "INDX_Blank_App")

if __name__ == '__main__':
    # parse out the parameters
    #print "Starting RUN.PY"
    args = parse_args();
    init()
    run(args);