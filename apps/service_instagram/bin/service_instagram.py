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
from threading import Timer
from indxclient import IndxClient

appid = "instagram_service"

class instagramService:

    def __init__(self, credentials, configs, instagram_add_info):
        #logging.debug("Got config items {0}".format(self.config))        
        try:
            if len(credentials)==4 and len(configs)>=4:
                self.credentials = credentials
                self.configs = configs
                self.instagram_add_info = instagram_add_info
                logging.debug('instagram Service - loading Service Instance')
                self.indx_con = IndxClient(self.credentials['address'], self.credentials['box'], self.credentials['username'], self.credentials['password'], appid)
                self.consumer_key= self.configs['consumer_key']
                self.consumer_secret= self.configs['consumer_secret']
                self.access_token = self.configs['access_token']
                self.access_token_secret = self.configs['access_token_secret']
                self.instagram_username = self.configs['instagram_username']
                self.since_id = 0
                self.version = 0
                self.batch = []
                self.batch_users = []
                self.tweet_count = 0
                self.tweet_count_total=0
                
                #set the auth access control
                self.auth = OAuthHandler(self.consumer_key, self.consumer_secret)
                self.auth.set_access_token(self.access_token, self.access_token_secret)
        except:
            logging.error("could not start instagramService, check config details - params might be missing")

    def stop_and_exit_service(self):
        logging.debug('instagram Service - HARD QUIT - instagram SERVICE')
        sys.exit()
   

    def run_main_services(self):
        #now get the tweets
        try:
            words_to_search = self.get_search_criteria()
            stream_active = True
            while(stream_active):
                stream_active = self.get_tweets(words_to_search)
            #the stream probably crashed out - Not my fault by silly instagram...
            #if this is the case, it's a good time harvest the user again, then restart the stream!
            self.frun_additional_services()
            self.run_main_services()
        except:
            logging.debug('Service Tweets - Could not run main service due to error: {0}'.format(sys.exc_info()))

    def run_additional_services(self):
        #see if other harvesters needed (indx con needed to sumbit data)


    def run_timeline_harvest(self, service):

        #first check 
    
    def insert_object_to_indx(self, service, obj):
     
        try:
            if len(obj)>0:
                response = service.indx_con.update(service.version, obj)
                logging.debug("Inserted Object into INDX: ".format(response))
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    service.version = json_response['@version']
                    logging.debug('INDX insert error in instagram Service Object: '+str(response))
                    try:
                        response = service.indx_con.update(service.version, obj)
                        logging.debug('instagram Service - Successfully added Objects into Box')
                    except:
                        logging.error('instagram Service, error on insert {0}'.format(response))
                else:
                    logging.error('instagram Service Unknow error: {0}'.format(e.read()))
            else:
                logging.error("Error updating INDX: {0}".format(e))


