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

            def find_followers_cb(res):

                def find_friends_cb(res):

                    def get_authen_user_feed_cb(res):

                        def get_popular_media_cb(res):

                            main_services_d.callback(True)                        

                        self.get_popular_media().addCallbacks(get_popular_media_cb, lambda failure: logging.error("Update Error {0}".format(failure)))

                    self.get_authenticated_user_feed().addCallbacks(get_authen_user_feed_cb, lambda failure: logging.error("Update Error {0}".format(failure)))
            
                self.find_friends(self.config['instagram_user_id']).addCallbacks(find_friends_cb, lambda failure: logging.error("Update Error{0}".format(failure)))

            self.find_followers(self.config['instagram_user_id']).addCallbacks(find_followers_cb, lambda failure: logging.error("Update Error{0}".format(failure)))
            #self.subscribe_to_objects_by_tag(self.config['instagram_search_words'])
        except:
            logging.debug('Service Instagram - Could not run main service due to error: {0}'.format(sys.exc_info()))

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


    def get_authenticated_user_feed(self):
        auth_d = Deferred()
        print "Getting Auth User's feed"
        user_feed = self.api.user_media_feed()

        current_timestamp = str(datetime.now())
        uniq_id = "user_feed_at_"+current_timestamp
        user_feed_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "user_feed": user_feed}
        # print user_feed_objs

        def update_cb(re):
            logging.debug("network harvest async worked {0}".format(re))
            auth_d.callback(True)

        def update_cb_fail(re):
            logging.error("network harvest async failed {0}".format(re))
            auth_d.errback

        self.insert_object_to_indx(user_feed_objs).addCallbacks(update_cb, update_cb_fail)
        
        return auth_d
        # for feed in user_feed:
        #     print feed

    def get_searched_media(self, search_terms):
        print "getting searched media for terms: "+str(search_terms)
        returned_results, page_num = self.api.tag_search(search_terms, 20)
        return returned_results
        # for result in returned_results:
        #     print result

    def get_popular_media(self):
        pop_d = Deferred()
        print "getting popular media"
        popular_media = self.api.media_popular(count=20)

        current_timestamp = str(datetime.now())
        uniq_id = "popular_media_at_"+current_timestamp
        popular_media_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "popular_media": popular_media}
        # print popular_media_objs

        def update_cb(re):
            logging.debug("network harvest async worked {0}".format(re))
            pop_d.callback(True)

        def update_cb_fail(re):
            logging.error("network harvest async failed {0}".format(re))
            pop_d.errback

        self.insert_object_to_indx(popular_media_objs).addCallbacks(update_cb, update_cb_fail)

        return pop_d


    def find_user(self, username):
        data = self.api.user_search(username, count=20)
        print data

    def find_followers(self, userid):
        follower_d = Deferred()
        print "getting followers of user: "+str(userid)
        followed_by = self.api.user_followed_by(userid)

        current_timestamp = str(datetime.now())
        uniq_id = "followers_at_"+current_timestamp
        followed_by_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "followed_by_list": followed_by}
        # print followed_by_objs
        #for friend in friends_list:
            #print friend
        #now append the results
        def update_cb(re):
            logging.debug("network harvest async worked {0}".format(re))
            follower_d.callback(True)

        def update_cb_fail(re):
            logging.error("network harvest async failed {0}".format(re))
            follower_d.errback

        self.insert_object_to_indx(followed_by_objs).addCallbacks(update_cb, update_cb_fail)
        
        return follower_d
        # print followed_by

    def find_friends(self, userid):
        friends_d = Deferred()
        print "getting friends of user: "+str(userid)
        friends_by_list = self.api.user_follows(userid)
        current_timestamp = str(datetime.now())
        uniq_id = "friends_at_"+current_timestamp
        friends_by_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "friends_by_list": friends_by_list}
        # print friends_by_objs
        #for friend in friends_list:
            #print friend
        #now append the results
        def update_cb(re):
            logging.debug("network harvest async worked {0}".format(re))
            friends_d.callback(True)

        def update_cb_fail(re):
            logging.error("network harvest async failed {0}".format(re))
            friends_d.errback

        self.insert_object_to_indx(friends_by_objs).addCallbacks(update_cb, update_cb_fail)
        
        return friends_d
        # print followed_by

    def subscribe_to_objects_by_tag(self,search_terms):

        def process_tag_update(update):
            print update

        reactor = subscriptions.SubscriptionsReactor()
        reactor.register_callback(subscriptions.SubscriptionType.TAG, process_tag_update)
        self.api.create_subscription(object='tag', object_id=search_terms, aspect='media', callback_url='http://localhost:8211/')



    def insert_object_to_indx(self, obj):

        update_d = Deferred()

        def update_cb(resp):
            self.version = resp['data']['@version']
            logging.debug("Succesfully Updated INDX with Objects in update_cb, new diff version of {0}".format(self.version))
            #logging.debug("Inserted Object into INDX: ".format(resp))
            update_d.callback(True)
            #return update_d
            #time.sleep(2)

        def exception_cb(e, service=self, obj=obj):
            logging.debug("Exception Inserting into INDX, probably wrong version given")
            if isinstance(e.value, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.value.code == 409: # 409 Obsolete
                    response = e.value.read()
                    json_response = json.loads(response)
                    service.version = json_response['@version']
                    logging.debug('INDX insert error in Twitter Service Object: '+str(response))
                    try:
                        service.indx_con.update(service.version, obj).addCallbacks(update_cb, exception_cb)
                        #logging.debug('Twitter Service - Successfully added Objects into Box')
                    except:
                        logging.error('Twitter Service, error on insert {0}'.format(response))
                        update_d.errback(e.value)
                else:
                    logging.error('Twitter Service Unknow error: {0}'.format(e.value.read()))
                    update_d.errback(e.value)
            else:
                logging.error("Error updating INDX: {0}".format(e.value))
                update_d.errback(e.value)
        
        logging.debug("in service_tweets - Trying to insert into indx...Current diff version: {0} and objects (len) given {1}".format(self.version, len(obj)))
        self.indx_con.update(self.version, obj).addCallbacks(update_cb, exception_cb)
        
        return update_d

#subscribe_to_objects_by_tag()

#run(host='localhost', port=8211, reloader=True)
