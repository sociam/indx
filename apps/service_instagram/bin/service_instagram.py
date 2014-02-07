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
from instagram.models import Media



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
        self.instagram_username = config['instagram_username']
        self.instagram_user_id = config['instagram_user_id']

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
        
        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = ""
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_instagram_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the instagram Config Object.')
            except:
                #print sys.exc_info()
                pass

            #print "Getting Auth User's feed"
            user_feed = self.api.user_media_feed()[0]
            try:
                latest_id = user_feed[0].id
            except:
                latest_id = "Null"
            ##find the highest id...

            if(latest_id != since_id ):

                logging.info("Found some new media, will insert it to INDX")
                since_id = latest_id
                objects_to_insert = []
                current_timestamp = str(time.time()).split(".")[0] #str(datetime.now())
                timestamp = str(datetime.now().isoformat('T')).split(".")[0]
                current_timestamp = str(datetime.now())

                #the user responsible for this

                #now create some nice user objects...
                for media in user_feed:

                    media_user_id = media.user.id
                    media_username = media.user.username


                    uniq_id = "instagram_media_"+media.id
                    user_feed_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"post", "instagram_user_id_indx":"instagram_user_me", "instagram_user_id": media_user_id, "instagram_username":media_username,
                    "media_id":media.id, "media_caption":media.caption, "media_url":media.get_standard_resolution_url(), "media_like_count":media.like_count}

                    #need to add INDX objects for tags and locations and the indx user of this

                    #create location if available
                    try:
                        location = media.location
                        uniq_id = "instagram_location_"+location.id
                        location_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"location", "instagram_location_id":location.id, "location_name": location.name, "latitude":location.point.latitude,
                        "longitude":location.point.longitude}

                        #now add this location to the user_feed_obj
                        user_feed_obj['media_location_id'] = location_obj
                        #thhen add it to a list of ojects to insert.
                        objects_to_insert.append(location_obj)
                    except:
                        pass
                   
                    try:
                        tag_ids = []
                        for tag in media.tags:
                            uniq_id = "instagram_tag_"+tag.name
                            tag_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"tag", "instagram_tag_name":tag.name}
                            tag_ids.append(uniq_id)
                            objects_to_insert.append(tag_obj)
                        
                        #now add this location to the user_feed_obj
                        user_feed_obj['tags'] = tag_ids
                    except:
                        pass

                    objects_to_insert.append(user_feed_obj)

                #now create the instagram_user_me object
                uniq_id = "instagram_user_me"
                instagram_me_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"user", "instagram_user_id":media_user_id, "instagram_username": media_username}
                objects_to_insert.append(instagram_me_obj)


                #and create the instagram config
                instagram_config_obj = {"@id": "service_instagram_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp,
                "config_for_instagram_user": self.instagram_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                "friends_list_size":friends_number, "followers_list_size": followers_number, "since_id":since_id}
                objects_to_insert.append(instagram_config_obj)

       
                def update_cb(re):
                    logging.debug("network harvest async worked {0}".format(re))
                    auth_d.callback(True)

                def update_cb_fail(re):
                    logging.error("network harvest async failed {0}".format(re))
                    auth_d.errback

                self.insert_object_to_indx(objects_to_insert).addCallbacks(update_cb, update_cb_fail)
            else:
                logging.info("already have the latest version of your instagram timeline")
                auth_d.callback(True)



        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_instagram_config = {"@id": "service_instagram_config"} 
        logging.info("Searching for instagram_config to check if Popular feed already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_instagram_config))
        def_search.addCallbacks(found_cb, error_cb)        
        
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

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = ""
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_instagram_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the instagram Config Object.')
            except:
                #print sys.exc_info()
                pass

        #if(since_id > 0):
            logging.info("getting popular media")
            
            objects_to_insert = []
            current_timestamp = str(time.time()).split(".")[0] #str(datetime.now())
            timestamp = str(datetime.now().isoformat('T')).split(".")[0]
            current_timestamp = str(datetime.now())
    
            popular_media = self.api.media_popular(count=20)

            for media in popular_media:

                media_user_id = media.user.id
                media_username = media.user.username

                #now create the instagram_user object
                uniq_user_id = "instagram_user_"+media.user.id
                instagram_media_obj = {"@id":uniq_user_id, "app_object": appid, "timestamp":timestamp, "type":"user","instagram_user_id":media_user_id, "instagram_username": media_username}
                objects_to_insert.append(instagram_media_obj)

                uniq_id = "instagram_media_"+media.id
                media_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"post", "instagram_user_id_indx":uniq_user_id, "instagram_user_id": media_user_id, "instagram_username":media_username,
                "media_id":media.id, "media_caption":media.caption, "media_url":media.get_standard_resolution_url(), "media_like_count":media.like_count}

                #need to add INDX objects for tags and locations and the indx user of this

                #create location if available
                try:
                    location = media.location
                    uniq_id = "instagram_location_"+location.id
                    location_obj = {"@id":uniq_id, "app_object": appid, "timestamp":timestamp, "type":"location", "instagram_location_id":location.id, "location_name": location.name, "latitude":location.point.latitude,
                    "longitude":location.point.longitude}

                    #now add this location to the user_feed_obj
                    media_obj['media_location_id'] = location_obj
                    #thhen add it to a list of ojects to insert.
                    objects_to_insert.append(location_obj)
                except:
                    pass
               
                try:
                    tag_ids = []
                    for tag in media.tags:
                        uniq_id = "instagram_tag_"+tag.name
                        tag_obj = {"@id":uniq_id, "app_object": appid, "type":"tag", "timestamp":timestamp, "instagram_tag_name":tag.name}
                        tag_ids.append(uniq_id)
                        objects_to_insert.append(tag_obj)
                    
                    #now add this location to the user_feed_obj
                    media_obj['tags'] = tag_ids
                except:
                    pass

                objects_to_insert.append(media_obj)


            def update_cb(re):
                logging.debug("network harvest async worked {0}".format(re))
                pop_d.callback(True)

            def update_cb_fail(re):
                logging.error("network harvest async failed {0}".format(re))
                pop_d.errback


            #and create the instagram config
            instagram_config_obj = {"@id": "service_instagram_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp,
            "config_for_instagram_user": self.instagram_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
            "friends_list_size":friends_number, "followers_list_size": followers_number, "since_id":since_id}
            objects_to_insert.append(instagram_config_obj)   

            self.insert_object_to_indx(objects_to_insert).addCallbacks(update_cb, update_cb_fail)

        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_instagram_config = {"@id": "service_instagram_config"} 
        logging.info("Searching for instagram_config to check if Popular feed already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_instagram_config))
        def_search.addCallbacks(found_cb, error_cb)


        return pop_d


    def find_user(self, username):
        data = self.api.user_search(username, count=20)
        print data

    def find_followers(self, userid):

        #first do a lookup and see if the latest set if followers has allready been found
        follower_d = Deferred()

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = 0
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_instagram_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the instagram Config Object.')
            except:
                #print sys.exc_info()
                pass
            followed_by = self.api.user_followed_by(userid)[0]
            #print "followed_by length: "+str(len(followed_by))
            #print str(followed_by)
            #see if the number is different, if it is, then update.. could be nicer than this, but for now, it will work (ish)
            if (len(followed_by) != followers_number) or (followers_number == 0): 

                followers_number = len(followed_by)
                objects_to_insert = []
                current_timestamp = str(time.time()).split(".")[0] #str(datetime.now())
                timestamp = str(datetime.now().isoformat('T')).split(".")[0]
                uniq_id = "instagram_follower_network_for_user_me" #+self.instagram_username
                followed_by_obj = {"@id":uniq_id, "app_object": appid, "instagram_username":self.instagram_username, "instagram_user_id":self.instagram_user_id, "timestamp":timestamp, "followed_by_count": len(followed_by)}

                followers_ids = []
                for follower in followed_by:
                    #print follower.username
                    uniq_id = "instagram_user_"+str(follower.username)
                    follower_obj = {"@id":uniq_id, "app_object": appid, "type":"user", "instagram_username":str(follower.username), "timestamp":timestamp}
                    objects_to_insert.append(follower_obj)
                    #we can add this to the followed_by_obj later
                    followers_ids.append(uniq_id)

                #link the followers for me
                followed_by_obj['follower_ids'] = followers_ids
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

                instagram_config_obj = {"@id":"service_instagram_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp,
                "config_for_instagram_user": self.instagram_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                "friends_list_size": friends_number, "followers_list_size": followers_number, "since_id":since_id}

                
                objects_to_insert.append(followed_by_obj)
                #objects_to_insert.append(followers)
                objects_to_insert.append(instagram_config_obj)

                self.insert_object_to_indx(objects_to_insert).addCallbacks(update_cb, update_cb_fail)
            else:
                follower_d.callback(True)

        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_instagram_config = {"@id": "service_instagram_config"} 
        logging.info("Searching for instagram_config to check if network already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_instagram_config))
        def_search.addCallbacks(found_cb, error_cb)
        
        return follower_d
        # print followed_by

    def find_friends(self, userid):
        friends_d = Deferred()
       

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = 0
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_instagram_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the instagram Config Object.')
            except:
                #print sys.exc_info()
                pass

            friends_by_list = self.api.user_follows(userid)[0]

            if (len(friends_by_list) != friends_number) or (friends_number == 0): 


                friends_number = len(friends_by_list)
                objects_to_insert = []
                current_timestamp = str(time.time()).split(".")[0] #str(datetime.now())
                timestamp = str(datetime.now().isoformat('T')).split(".")[0]
                uniq_id = "instagram_friends_network_for_user_me"#+self.instagram_username
                friends_by_obj = {"@id":uniq_id, "app_object": appid, "instagram_username":self.instagram_username, "instagram_user_id":self.instagram_user_id, "timestamp":timestamp, "followed_by_count": len(friends_by_list)}

                friends_ids = []
                for friend in friends_by_list:
                    #print follower.username
                    uniq_id = "instagram_user_"+str(friend.username)
                    friend_obj = {"@id":uniq_id, "app_object": appid, "type":"user", "instagram_username":str(friend.username), "timestamp":timestamp}
                    objects_to_insert.append(friend_obj)
                    #we can add this to the followed_by_obj later
                    friends_ids.append(uniq_id)

                friends_by_obj['friends_ids'] = friends_ids
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


                instagram_config_obj = {"@id": "service_instagram_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp,
                "config_for_instagram_user": self.instagram_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                "friends_list_size": friends_number, "followers_list_size": followers_number, "since_id":since_id}


                objects_to_insert.append(friends_by_obj)
                #objects_to_insert.append(followers)
                objects_to_insert.append(instagram_config_obj)

                self.insert_object_to_indx(objects_to_insert).addCallbacks(update_cb, update_cb_fail)
            else:
                friends_d.callback(True)


        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_instagram_config = {"@id": "service_instagram_config"} 
        logging.info("Searching for instagram_config to check if network already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_instagram_config))
        def_search.addCallbacks(found_cb, error_cb)
            
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
