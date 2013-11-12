import logging,json,argparse,sys
import logging.config

if __name__ == '__main__':
	# parse out the parameters
	parser = argparse.ArgumentParser(prog="run")
	parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
	parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
	parsed = parser.parse_args()
	print parsed

logging.basicConfig(filename="blank.log", level=logging.DEBUG)
args = vars(parser.parse_args())
if args['config']:
    config = json.loads(args['config'])
    logging.debug("received config: {0}".format(config))
else:
	logging.debug("running the app");
	# tadaaa

