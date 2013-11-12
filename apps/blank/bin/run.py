import logging,json,argparse,sys

if __name__ == '__main__':
	# parse out the parameters
	parser = argparse.ArgumentParser(prog="run")
	parser.add_argument('--config')
	parsed = parser.parse_args()
	print parsed

if args['config']:
    logging.debug("received config: {0}".format(args['config']))
    config = json.loads(args['config'])
else:
	logging.debug("running the app");
	# tadaaa

