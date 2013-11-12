import logging,json,argparse,sys
import logging.config
import keyring
import keyring.util.platform_

if __name__ == '__main__':
    # parse out the parameters
    parser = argparse.ArgumentParser(prog="run")
    parser.add_argument('--config')
    parsed = parser.parse_args()
    print parsed

logging.basicConfig(filename="blank.log", level=logging.DEBUG)
args = vars(parser.parse_args())
if args['config']:
    config = json.loads(args['config'])
    logging.debug("received config: {0}".format(config))
    keyring.set_password("INDX", "INDX_Blank_App", config)
else:
    print(keyring.util.platform_.data_root())
    config = keyring.get_password("INDX", "INDX_Blank_App")
    logging.debug("running the app with: {0}".format(config));

# keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
# print keyring.get_password("INDX", "INDX_Blank_App")