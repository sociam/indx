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

import bottle
from bottle import route, post, run, request
import argparse, ast, logging, getpass, sys, urllib2, json, sys, datetime, time, threading
from datetime import datetime
from threading import Timer
#from indxclient import IndxClient
from instagram import client, subscriptions
from instagram.client import InstagramAPI

bottle.debug(True)


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


def get_popular_media():
    api = InstagramAPI(client_id=client_id, client_secret=client_secret, redirect_uri="http://localhost:8515")
    popular_media = api.media_popular(count=20)
    for media in popular_media:
        print media.images['standard_resolution'].url


#get_popular_media()


def find_user():
    api = InstagramAPI(access_token="211184138.e118fb9.4887b8a8c27e4ff9be93b554dba17960")
    data = api.user_search("raminetinati", count=20)
    print data


def find_followers():
    api = InstagramAPI(access_token="211184138.e118fb9.4887b8a8c27e4ff9be93b554dba17960")
    followed_by = api.user_followed_by(211184138)
    print followed_by


#find_user()
#find_followers()


def subscribe_to_objects_by_tag():

    def process_tag_update(update):
        print update
    

    api = InstagramAPI(client_id=client_id, client_secret=client_secret, redirect_uri="http://localhost:8515")
    reactor = subscriptions.SubscriptionsReactor()
    reactor.register_callback(subscriptions.SubscriptionType.TAG, process_tag_update)
    api.create_subscription(object='tag', object_id='christmas', aspect='media', callback_url='http://localhost:8515/')





#subscribe_to_objects_by_tag()

#run(host='localhost', port=8211, reloader=True)
