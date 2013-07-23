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

import argparse, logging, getpass, sys, urllib2, json
from pyindx import IndxClient
from tweepy.streaming import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream

""" Set up the arguments, and their defaults. """
parser = argparse.ArgumentParser(description='Run a continuous twitter search and import tweets into INDX.')
parser.add_argument('user', type=str, help="INDX username, e.g. indx")
parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
parser.add_argument('box', type=str, help="Box to assert tweets into")
parser.add_argument('words', type=str, help="Words to search for, comma separated")
parser.add_argument('--appid', type=str, default="Twitter Harvester", help="Override the appid used for the INDX assertions")
parser.add_argument('--debug', default=False, action="store_true", help="Enable debugging")
parser.add_argument('--profile', default=False, action="store_true", help="Enable profiling")
args = vars(parser.parse_args())

if args['debug']:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

# Prompt for the INDX password
password = getpass.getpass()
indx = IndxClient(args['address'], args['box'], args['user'], password, args['appid'])
version = 0 # box version
batch = [] # batch update multiple tweets at once

# Go to http://dev.twitter.com and create an app.
# The consumer key and secret will be generated for you after
consumer_key="3vO0rL4ehLyzyLVdHko4kQ"
consumer_secret="zKwEfP6VIMQmiewrC85RMXbk2JFqhLQpg2BexAc7k"

# After the step above, you will be redirected to your app's page.
# Create an access token under the the "Your access token" section
access_token="1560608402-7z7LsgShCDSdSA9R23ZpdAgBHAP2jGcLGQTsTJI"
access_token_secret="23cUsm4IspERlY0tRlbYHu2aJ7gvk8GkZx7EDH1AnYY"
# access is read-only so no need to worry about them hijacking the
# account

class INDXListener(StreamListener):
    """ A listener handles tweets are the received from the stream.
    This is a basic listener that just prints received tweets to stdout.

    """
    def on_data(self, tweet_data):
        """ Assert the tweet into INDX.
        If the version is incorrect, the correct version will be grabbed and the update re-sent.
        
        tweet -- The tweet to assert into the box.
        """
        global version
        global batch
        try:
            tweet = json.loads(tweet_data)
            logging.debug("{0}, {1}".format(type(tweet), tweet))
            if not tweet.get('text'):
                # TODO: log these for provenance?                
                logging.info("Skipping informational message: '{0}'".format(tweet_data.encode("utf-8")))
                return
            logging.info("Adding tweet: '{0}'".format(tweet['text'].encode("utf-8")))            
            tweet["@id"] = unicode(tweet['id'])
            batch.append(tweet)
            if len(batch) > 25:
                response = indx.update(version, batch)
                version = response['data']['@version'] # update the version
                batch = []
#            response = indx.update(version, tweet)
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    version = json_response['@version']
                    self.on_data(tweet_data) # try updating again now the version is correct
                pass
            else:
                logging.error("Error updating INDX: {0}".format(e))
                sys.exit(0)                    
        return True

    def on_error(self, status):
        print status

if __name__ == '__main__':
    def get_tweets():
        l = INDXListener()
        auth = OAuthHandler(consumer_key, consumer_secret)
        auth.set_access_token(access_token, access_token_secret)
        stream = Stream(auth, l)
        if len(args['words']) > 0:
            stream.filter(track=args['words'].split(","))
        else:
            stream.sample()

    if args['profile']:
        import cProfile
        cProfile.run('get_tweets()')
    else:
        get_tweets()

