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
from threading import Timer, Thread
from indxclient import IndxClient
from tweepy.streaming import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream
from tweepy import API
from tweepy import Status
from service_tweets import TwitterService
from twisted.internet.defer import Deferred as D
from twisted.internet import task
from twisted.internet import reactor
from twisted.python import log


    
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
            print "loading Credentials...."
            #config = json.dumps(config)
            #config = config.replace("\"","'")
            #config = ast.literal_eval(config)
            for k,v in config.iteritems():
                print k,v
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

        #load the main services
        #twitter_service.run_main_services()

        def called(result):
            logging.info('Service Controller Twitter - Retreiving Stream')


        def command_die(reason):
            logging.error('Service Controller Twitter - Retreiving Stream Failed, error is {0}'.format(reason))

        
        first_run = True

        def loop_harvester():
            #print "running harvester"
            twitter_service.run_additional_services()
            if first_run:
                twitter_service.run_main_services()
            logging.debug("setting up Reactor loop...")
            reactor.callLater(15.0, loop_harvester);

        logging.info("Service Controller Twitter - running Additional Taks with Twisted Reactor")
        loop_harvester() 

        first_run = False
        #print "Service Controller Twitter - running Main service"
        #task_main_get_stream = reactor.callLater(3.5, twitter_service.run_main_services())
        #task_main_get_stream.addCallback(called)
        #task_main_get_stream.addErrback(command_die)
        
        #run the reactor!
        reactor.run()