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
from threading import Timer, Thread
from indxclient import IndxClient
from service_instagram import instagramService
from twisted.internet.defer import Deferred
from twisted.internet import task
from twisted.internet import reactor
from twisted.python import log
from instagram.client import InstagramAPI

   
logging.basicConfig(level=logging.INFO)

app_id = "instagram_service"
client_id = "e118fb9760de432cb97df38babede8d9"
client_secret = "adec102932e44bb89511a6c33518225c"
redirect_uri = "http://localhost:8211/apps/service_instagram/redirect_target.html"


class instagramServiceController:

    def __init__(self, config):
        #test if only looking for access_token....
        print "in instagram service controller:: "+str(config)
        if 'instagram_auth_status' in config:
            config_json = json.loads(config)
            self.load_parameters(config_json)
            #print "Attempting to run: "+str(config_json)
        elif 'access_token_code' in config:
            config_json = json.loads(config)
            self.access_token_code = config_json['access_token_code']
            self.client_id = client_id
            self.client_secret = client_secret
            self.redirect_uri = redirect_uri
        elif 'access_token_url' in config:
            print "in instagram service controller:: "+str(config)
            self.client_id = client_id
            self.client_secret = client_secret
            self.redirect_uri = redirect_uri
            self.scope = ["basic"]
            print "in instagram service controller - got the access token config"
        else:
            #First get the parameters ready for the Harvester
            print "no config added"

    #load and managed parameters
    def load_parameters(self, config):
        self.config = config
        self.config['app_id'] = app_id
        # self.access_token = config.access_token
        # self.access_token_timestamp = config.access_token_timestamp    
        # self.instagram_username = config.instagram_username
        # self.instagram_search_words = config.instagram_search_words
        # self.instagram_userfeed = config.instagram_userfeed
        # self.instagram_auth_status = config.instagram_auth_status
        # print "parameters loaded"

    def load_service_instance(self):

        print "loading server instance"
        instagram_service = instagramService(self.config)

        def indx_cb(empty):          
            
            #first_run = True

            logging.info("Service Controller Instagram - Running Instagram Service!")
            #def loop_harvester():
                #print "running harvester"
                
            def main_services_cb(res):
                if res:
                    print "Instagram Harvester Completed, now waiting an hour..."
                    reactor.callLater(3600.0, self.load_service_instance)
                else:
                    print "Instagram harvester Failed, waiting an hour to try again..."

            instagram_service.run_main_services().addCallbacks(main_services_cb, lambda failure: logging.error("Additional Callback Error"))

        instagram_service.get_indx().addCallbacks(indx_cb, lambda failure: logging.error("Instagram Service Controller error logging into INDX: {0}".format(failure)))
        
        reactor.run()


    def get_access_token_url(self):
        api = InstagramAPI(client_id=self.client_id, client_secret=self.client_secret, redirect_uri=self.redirect_uri)
        redirect_uri = api.get_authorize_login_url(scope = self.scope)
        # if(redirect_uri):
        #     response = urllib2.urlopen(redirect_uri).read()
        return redirect_uri


    def get_access_token_from_code(self):
        api = InstagramAPI(client_id=self.client_id, client_secret=self.client_secret, redirect_uri=self.redirect_uri)
        access_token = api.exchange_code_for_access_token(self.access_token_code)
        #print "got an access token: "+str(access_token[0])
        access_token_timestamp = str(datetime.datetime.now())
        instagram_username = access_token[1]['username']
        instagram_user_id = access_token[1]['id']
        #print instagram_username
        config = {'access_token':access_token[0], 'access_token_timestamp':access_token_timestamp, 'instagram_auth_status':'True', 'instagram_username':instagram_username, 'instagram_user_id':instagram_user_id}
        # if(redirect_uri):
        #     response = urllib2.urlopen(redirect_uri).read()
        return config