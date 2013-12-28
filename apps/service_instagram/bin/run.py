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

import ast,logging,json,argparse,sys,time,os
import logging.config
import keyring
import keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from service_controller_instagram import instagramServiceController



logging.basicConfig(level=logging.DEBUG)

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
        #print args['config']
        config = json.loads(args['config'])
        #see if this is a config to get access token code
        #print "Got a config of: "+str(config)
        #print len(config)
        if 'access_token_code' in args['config']:
            print "Got the Access Token code Config"
            service_controler = instagramServiceController(args['config'])
            access_token_config = service_controler.get_access_token_from_code()
            #access_token_config = json.loads(str(access_token_config))
            config = {}
            config['access_token'] = access_token_config['access_token']
            config['access_token_timestamp'] = access_token_config['access_token_timestamp']
            config['instagram_auth_status'] = 'true'

            logging.debug("received access token and confirm. for saving: {0}".format(config))
            keyring.set_password("INDX", "INDX_Instagram_App", json.dumps(config))
            print "Set the Access Token"+str(config)
        elif 'access_token_url' in args['config']:
            #print "Got the Access Token Config"
            service_controler = instagramServiceController(args['config'])
            access_token_url = service_controler.get_access_token_url()
            config = {}
            config['access_token_url'] = access_token_url        
            #Now save the short 
            logging.debug("received short access token config for saving: {0}".format(config))
            keyring.set_password("INDX", "INDX_Instagram_App", json.dumps(config))
        else:
            #print "Got the Main Access Token Config"
            logging.debug("received config for saving: {0}".format(config))
            keyring.set_password("INDX", "INDX_Instagram_App", json.dumps(config))
    elif args['get_config']:
        print json.dumps(get_config(args))
    else:
        # print(keyring.util.platform_.data_root())
        config = keyring.get_password("INDX", "INDX_Instagram_App")
        logging.debug("running the app with: {0}".format(config))
        config = json.loads(config)
        #config = config.replace("\\\"","'")
        #config = ast.literal_eval(ast.literal_eval(config))
        address = args['server']
        config['address'] = address
        #config = json.loads(config)
        #logging.info("In instagram Run - With new config file JSON {0}".format(config))
        #to_add = {}
        #to_add = {"address": address}
        #config_new = (config, to_add)
        logging.debug("In instagram Run - With new config file {0}".format(config))
        #test run with configs
        #instagram_service = TwitterService(config)
        service_controler = instagramServiceController(config)
        service_controler.load_service_instance()
        time.sleep(2)

    # keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
    # print keyring.get_password("INDX", "INDX_Blank_App")


def get_config(args):
    #print "Getting config from keychain..."
    stored_config = keyring.get_password("INDX", "INDX_Instagram_App")
    #print "stored config----------"+str(stored_config)
    #config = ast.literal_eval(stored_config)
    try:
        #stored_config = json.dumps(stored_config)
        stored_config = ast.literal_eval(stored_config)
    except:
        print "error in get_config run: "+str(sys.exc_info()[0])
        #empty config, probably not set...
        stored_config = {'empty': True}
    #stored_config = ast.literal_eval(stored_config)
    logging.debug("Twitter Run.py - get_configs stored instagram config {0}".format(stored_config))
    return stored_config




if __name__ == '__main__':
    # parse out the parameters
    args = parse_args();
    init()
    run(args);