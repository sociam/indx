import logging,json,argparse,sys
import logging.config

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
else:
	logging.debug("running the app");
	# tadaaa

