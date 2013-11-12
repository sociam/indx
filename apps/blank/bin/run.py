import logging,json,argparse,sys,time
import logging.config
import keyring
import keyring.util.platform_

if __name__ == '__main__':
    # parse out the parameters
	parser = argparse.ArgumentParser(prog="run")
	parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
	parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
	parsed = parser.parse_args()
	# print parsed

logging.basicConfig(filename="blank.log", level=logging.DEBUG)
args = vars(parser.parse_args())
if args['config']:
    config = json.loads(args['config'])
    # logging.debug("received config: {0}".format(config))
    keyring.set_password("INDX", "INDX_Blank_App", json.dumps(config))
elif args['get_config']:
	# TODO output the stored config (for passing ti back to the server)
	print json.loads(keyring.get_password("INDX", "INDX_Blank_App"))
	pass
else:
    print(keyring.util.platform_.data_root())
    config = keyring.get_password("INDX", "INDX_Blank_App")
    logging.debug("running the app with: {0}".format(config));
    time.sleep(2)

# keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
# print keyring.get_password("INDX", "INDX_Blank_App")
