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
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from instagram import client, subscriptions
from instagram.client import InstagramAPI



appid = "instagram_service"


class instagramService:

    def __init__(self, config):
        self.config = config
        self.api = InstagramAPI(access_token=config['access_token']) 
        self.version = 0
        self.batch = []
        self.batch_users = []
        self.feed_count = 0
        self.feed_count_total=0

    def stop_and_exit_service(self):
        logging.debug('instagram Service - HARD QUIT - instagram SERVICE')
        sys.exit()
   

    def run_main_services(self):

        main_services_d = Deferred()
        try:
            print "running instagram main services"
            self.find_followers(self.config['instagram_user_id'])
            self.get_authenticated_user_feed()
            self.get_popular_media()
            self.subscribe_to_objects_by_tag(self.config['instagram_search_words'])
        except:
            logging.debug('Service Instagram - Could not run main service due to error: {0}'.format(sys.exc_info()))
        main_services_d.callback(True)
        return main_services_d

    def get_indx(self):

        return_d = Deferred()

        def authed_cb(): 
            logging.debug("in service_tweets - Authed Callback")
            logging.debug("in service_tweets - get_indx authclient Auth status: {0}".format(authclient.is_authed))
        
            def token_cb(token):
                self.indx_con = IndxClient(self.config['address'], self.config['box'], appid, token = token, client = authclient.client)
                return_d.callback(True)

            authclient.get_token(self.config['box']).addCallbacks(token_cb, return_d.errback)
         
        def authed_cb_fail(re): 
            logging.debug("in service tweets - get_indx/authed_cb failed for reason {0}".format(re))
            return_d.errback   

        logging.debug("in service_instagram - get_indx")    
        authclient = IndxClientAuth(self.config['address'], appid)
        authclient.auth_plain(self.config['user'], self.config['password']).addCallbacks(lambda response: authed_cb(), authed_cb_fail)

        return return_d


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


    def get_authenticated_user_feed(self):
        print "Getting Auth User's feed"
        user_feed = self.api.user_media_feed()
        for feed in user_feed:
            print feed

    def get_searched_media(self, search_terms):
        print "getting searched media for terms: "+str(search_terms)
        returned_results, page_num = self.api.tag_search(search_terms, 20)
        for result in returned_results:
            print result

    def get_popular_media(self):
        print "getting popular media"
        popular_media = self.api.media_popular(count=20)
        for media in popular_media:
            print media.images['standard_resolution'].url

    def find_user(self, username):
        data = self.api.user_search(username, count=20)
        print data

    def find_followers(self, userid):
        print "getting followers of user: "+str(userid)
        followed_by = self.api.user_followed_by(userid)
        print followed_by



    def subscribe_to_objects_by_tag(self,search_terms):

        def process_tag_update(update):
            print update

        reactor = subscriptions.SubscriptionsReactor()
        reactor.register_callback(subscriptions.SubscriptionType.TAG, process_tag_update)
        self.api.create_subscription(object='tag', object_id=search_terms, aspect='media', callback_url='http://localhost:8211/')





#subscribe_to_objects_by_tag()

#run(host='localhost', port=8211, reloader=True)
