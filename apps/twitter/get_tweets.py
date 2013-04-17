#    This file is part of WebBox.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import tweetstream, argparse, logging, getpass, sys, urllib, urllib2, json
from pywebbox import WebBox


""" Set up the arguments, and their defaults. """
parser = argparse.ArgumentParser(description='Run a continuous twitter search and import tweets into a Webbox.')
parser.add_argument('user', type=str, help="Webbox username, e.g. webbox")
parser.add_argument('address', type=str, help="Address of the webbox server, e.g. http://webbox.example.com:8211/")
parser.add_argument('box', type=str, help="Box to assert tweets into")
parser.add_argument('twitter-user', type=str, help="Twitter username")
parser.add_argument('twitter-password', type=str, help="Twitter password")
parser.add_argument('words', type=str, help="Words to search for, comma separated")
parser.add_argument('--appid', type=str, default="Twitter Harvester", help="Override the appid used for the webbox assertions")
parser.add_argument('--debug', default=False, action="store_true", help="Enable debugging")
args = vars(parser.parse_args())

if args['debug']:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

# Prompt for the webbox password
password = getpass.getpass()

webbox = WebBox(args['address'], args['box'], args['user'], password, args['appid'])
version = 0 # box version

def update(tweet):
    """ Assert the tweet into the webbox.
        If the version is incorrect, the correct version will be grabbed and the update re-sent.

        tweet -- The tweet to assert into the box.
    """
    global version
    try:
        response = webbox.update(version, tweet)
        version = response['data']['@version'] # update the version
    except Exception as e:
        if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
            if e.code == 409: # 409 Obsolete
                response = e.read()
                json_response = json.loads(response)
                version = json_response['@version']
                update(tweet) # try updating again now the version is correct
        else:
            logging.error("Error updating webbox: {0}".format(e))
            sys.exit(0)

""" Get tweets forever. """
while True:
    try:
        with tweetstream.FilterStream(args['twitter-user'], args['twitter-password'], track = args['words'].split(",")) as stream:
            for tweet in stream:
                logging.info("Adding tweet: '{0}'".format(tweet['text'].encode("utf-8")))
                tweet["@id"] = unicode(tweet['id'])
                update(tweet)

    except Exception as e:
        logging.error("Exception getting tweets: {0}".format(e))
        sys.exit(0)


