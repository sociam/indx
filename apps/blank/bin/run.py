
import logging,json,argparse,sys

if __name__ == '__main__':
	# parse out the parameters
	parser = argparse.ArgumentParser(prog="run")
	parser.add_argument('--config')
	parsed = parser.parse_args()
	print parsed
