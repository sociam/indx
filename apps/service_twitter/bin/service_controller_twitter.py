#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#    Copyright (C) 2011-2013 Ramine Tinati
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

import argparse, ast, logging, getpass, sys, urllib2, json, sys, tweepy, datetime, time, threading
from datetime import datetime
from datetime import timedelta
from threading import Timer, Thread
from tweepy.streaming import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream
from tweepy import API
from tweepy import Status
from service_tweets import TwitterService
from twisted.internet import task
from twisted.internet import reactor
from twisted.python import log
from twisted.internet.defer import Deferred



    
logging.basicConfig(level=logging.INFO)


class TwitterServiceController:

    def __init__(self, config):
        #First get the parameters ready for the Harvester
        self.credentials, self.configs, self.twitter_add_info = self.load_parameters(config)


    #load and managed parameters
    def load_parameters(self, config):
        credentials = {}
        configs = {}
        twitter_add_info = {}
        try:
            logging.debug("Twitter Service - loading Credentials....")
            #config = json.dumps(config)
            #config = config.replace("\"","'")
            #config = ast.literal_eval(config)
            #for k,v in config.iteritems():
                #print k,v
            credentials = {"address": config['address'], "box": config['box'], "username": config['user'], "password": config['password']} 
            configs = {"consumer_key": config['consumer_key'], "consumer_secret": config['consumer_secret'], "access_token": config['access_token'], 
            "access_token_secret": config['access_token_secret'], "twitter_username": config['twitter_username'], "twitter_search_words": config['twitter_search_words']}
            try:
                twitter_add_info = {"twitter_status":config['twitter_status'], "twitter_network":config['twitter_network']}
            except:
                twitter_add_info = {}

            return (credentials, configs, twitter_add_info)
        except:
            logging.error("COULD NOT START TWITTER APP - NO/INCORRECT CREDENTIALS "+str(sys.exc_info()))
            return (credentials, configs, twitter_add_info)       



    
    def load_service_instance(self):

        twitter_service = TwitterService(self.credentials, self.configs, self.twitter_add_info)
        #twitter_service_two = TwitterService(self.credentials, self.configs, self.twitter_add_info)
        timestamp_first_run = datetime.now()


        #load the main services
        #twitter_service.run_main_services()

        def indx_cb(empty):          
            
            #first_run = True

            logging.info("Service Controller Twitter - Running Twitter Service!")
            #def loop_harvester():
                #print "running harvester"
                
            def additional_cb(res, twitter_service=twitter_service):

                def get_tweets_cb(resum, twitter_service=twitter_service):
                    #check if indx is about to expire
                    timestamp_current = datetime.now()
                    timestamp_first_run_minus_five_hours = timestamp_current - timedelta(hours=5)
                    
                    if timestamp_first_run_minus_five_hours > timestamp_first_run:
                        logging.info("Time has come to reset the INDX client!")
                        twitter_service.get_indx().addCallbacks(indx_cb, lambda failure: logging.error("Twitter Service Controller error logging into INDX: {0}".format(failure)))
                    
                    # elif twitter_service.tweet_count == 0:
                    #     logging.info("Stream reset to give time to reharvest the status and friends list...")
                    #     twitter_service.load_additional_harvesters(twitter_service.twitter_add_info, twitter_service).addCallbacks(additional_cb, lambda failure: logging.error("Additional Callback Error"))
                    else:
                        logging.info("Stream reset to store objects into INDX, Total Tweets collected {0} now time to start it up again...".format(twitter_service.tweet_count))
                        twitter_service.get_tweets(twitter_service.get_search_criteria()).addCallbacks(get_tweets_cb, lambda failure: logging.error("error in get_tweets"))

                twitter_service.get_tweets(twitter_service.get_search_criteria()).addCallbacks(get_tweets_cb, lambda failure: logging.error("error in get_tweets"))

            twitter_service.load_additional_harvesters(twitter_service.twitter_add_info, twitter_service).addCallbacks(additional_cb, lambda failure: logging.error("Additional Callback Error"))

        twitter_service.get_indx().addCallbacks(indx_cb, lambda failure: logging.error("Twitter Service Controller error logging into INDX: {0}".format(failure)))
        reactor.run()