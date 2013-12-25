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

import argparse, ast, logging, getpass, sys, urllib2, json, sys, datetime, time, threading
from datetime import datetime
from threading import Timer, Thread
from indxclient import IndxClient
from service_instagram import instagramService
from twisted.internet.defer import Deferred as D
from twisted.internet import task
from twisted.internet import reactor
from twisted.python import log
from instagram.client import InstagramAPI

   
logging.basicConfig(level=logging.INFO)

client_id = "e118fb9760de432cb97df38babede8d9"
client_secret = "adec102932e44bb89511a6c33518225c"
redirect_uri = "http://localhost:8211/"


class instagramServiceController:

    def __init__(self, config):
        #test if only looking for access_token....
        if "access_token_url" in config:
            self.client_id = client_id
            self.client_secret = client_secret
            self.redirect_uri = redirect_uri
            self.scope = ["basic"]
            print "in instagram service controller - got the access token config"
        else:
            #First get the parameters ready for the Harvester
            self.credentials, self.configs, self.instagram_add_info = self.load_parameters(config)


    #load and managed parameters
    def load_parameters(self, config):
        credentials = {}
        configs = {}
        instagram_add_info = {}
        try:
            logging.debug("instagram Service - loading Credentials....")
            #config = json.dumps(config)
            #config = config.replace("\"","'")
            #config = ast.literal_eval(config)
            #for k,v in config.iteritems():
                #print k,v
            credentials = {"address": config['address'], "box": config['box'], "username": config['user'], "password": config['password']} 
            configs = {"consumer_key": config['consumer_key'], "consumer_secret": config['consumer_secret'], "access_token": config['access_token'], 
            "access_token_secret": config['access_token_secret'], "instagram_username": config['instagram_username'], "instagram_search_words": config['instagram_search_words']}
            try:
                instagram_add_info = {"instagram_status":config['instagram_status'], "instagram_network":config['instagram_network']}
            except:
                instagram_add_info = {}

            return (credentials, configs, instagram_add_info)
        except:
            logging.error("COULD NOT START instagram APP - NO/INCORRECT CREDENTIALS "+str(sys.exc_info()))
            return (credentials, configs, instagram_add_info)       


    def load_service_instance(self):

        instagram_service = instagramService(self.credentials, self.configs, self.instagram_add_info)
        #instagram_service_two = instagramService(self.credentials, self.configs, self.instagram_add_info)

        #load the main services
        #instagram_service.run_main_services()

        def called(result):
            logging.info('Service Controller instagram - Retreiving Stream')


        def command_die(reason):
            logging.error('Service Controller instagram - Retreiving Stream Failed, error is {0}'.format(reason))

        
        first_run = True

        logging.info("Service Controller instagram - Running instagram Service!")

        def loop_harvester():
            #print "running harvester"
            instagram_service.run_additional_services()
            #if not first_run:
                #instagram_service.run_main_services()
            logging.debug("setting up Reactor loop...")
            reactor.callLater(10.0, instagram_service.run_main_services());

        loop_harvester() 

        first_run = False

        reactor.run()


    def get_access_token(self):
        api = InstagramAPI(client_id=self.client_id, client_secret=self.client_secret, redirect_uri=self.redirect_uri)
        redirect_uri = api.get_authorize_login_url(scope = self.scope)
        # if(redirect_uri):
        #     response = urllib2.urlopen(redirect_uri).read()
        return redirect_uri