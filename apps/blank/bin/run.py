import logging,json,argparse,sys,time,os
import logging.config
import keyring
import keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring


logging.basicConfig(filename="blank.log", level=logging.DEBUG)

def parse_args():
    parser = argparse.ArgumentParser(prog="run")
    parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
    parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
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
    if args['config']:
        print(keyring.util.platform_.data_root())
        config = json.loads(args['config'])
        logging.debug("received config: {0}".format(config))
        keyring.set_password("INDX", "INDX_Blank_App", json.dumps(config))
    elif args['get_config']:
        # TODO output the stored config (for passing ti back to the server)
        result = keyring.get_password("INDX", "INDX_Blank_App")
        if result is None:
            result = "{}"
        print result
    else:
        # print(keyring.util.platform_.data_root())
        config = keyring.get_password("INDX", "INDX_Blank_App")
        logging.debug("running the app with: {0}".format(config));
        time.sleep(2)

    # keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
    # print keyring.get_password("INDX", "INDX_Blank_App")

if __name__ == '__main__':
    # parse out the parameters
    args = parse_args();
    init()
    run(args);