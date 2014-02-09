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

import argparse, ast, logging, getpass, sys, urllib2, json, sys, datetime, time, threading, facebook
from facebook import GraphAPI
from datetime import timedelta
from threading import Timer
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from twisted.internet import reactor, threads


FACEBOOK_APP_ID = "415327441930292"
FACEBOOK_APP_SECRET = "f8a18987d9c8641b9797df94d916b653"

user_token = "CAACEdEose0cBAMcqUvpsZCb4tqByxcL7lUceoXjArKieThZAUaIFEtNTa7dcErlZBiBYjboZCG3oHyT5yZAQdZAiIwc2Mk2a29tWyUAW7vL6ZBpRGP30uZAdZArnXnyvxnAIMsQNs3lZAmPewL7h368bHuFt3T55hlvoxmQMZBAqEEz0yvJlOAPGrdPQJcTvHePMoaEi6t6PYIaVgZDZD"
#user_token = "CAAGRfoP2rgIBAAjSVaznIsZCxubV8KzTYZBrhRaDhA9pGA8hK2kOjRtgQlTUZANl0n0uJFtk3ZBDO1mBZCfOE06ku3P1NRr8NrN30xsHUgZBCwJJgCMoEoW2J7w7l85C6ZBC89ggaLxkaZAUdSaK8nYKT8ZBZAsSHayzGAPQS1kSPZALMVGf201oaTPf13VMGm32EIY4egRXy7wDAZDZD"
app_token = "441447542599170|8B8irGqMVlyLl1Bke4Nm9Y6pquo"

app_id = "facebook_service"

class FacebookService:

    def __init__(self, config):
        logging.debug('Facebook Service - Getting configs from Facebook Controller')
        self.config = config
        self.facebook_access_token_long = config['facebook_access_token_long']
        self.facebook_userid = config['facebook_userid']
        self.facebook_access_token_expire_time = config['facebook_access_token_expire_time']
        self.config_timestamp = config['config_timestamp']
        self.version = 0
        #in reality this is all we need from facebook, but we want to also check that the current date is not over 60 days...
        logging.debug('Facebook Service - Checking if token is not expired')
        self.token_active = False
        if self.check_if_token_not_expired():
            logging.info('Facebook Service - Token is active still. Great News!')
            self.token_active = True

    def get_indx(self):

        return_d = Deferred()

        def authed_cb(): 
            logging.info("in service_tweets - Authed Callback")
            logging.info("in service_tweets - get_indx authclient Auth status: {0}".format(authclient.is_authed))
        
            def token_cb(token):
                self.indx_con = IndxClient(self.config['address'], self.config['box'], app_id, token = token, client = authclient.client)
                return_d.callback(True)

            authclient.get_token(self.config['box']).addCallbacks(token_cb, return_d.errback)
         
        def authed_cb_fail(re): 
            logging.debug("in Facebook Service - get_indx/authed_cb failed for reason {0}".format(re))
            return_d.errback   

        logging.info("in Facebook Service - get_indx")    
        authclient = IndxClientAuth(self.config['address'], app_id)
        authclient.auth_plain(self.config['user'], self.config['password']).addCallbacks(lambda response: authed_cb(), authed_cb_fail)

        return return_d


#     def get_indx(self):
#         return_d = Deferred()
# #        self.indx_con = IndxClient(self.config['address'], self.config['box'], self.config['user'], self.config['password'], app_id)
#         def authed_cb(): 
#             def token_cb(token):
#                 self.indx_con = IndxClient(self.config['address'], self.config['box'], app_id, token = token)
#                 return_d.callback(True)

#             authclient.get_token(self.config['box']).addCallbacks(token_cb, return_d.errback)
            
#         authclient = IndxClientAuth(self.config['address'], app_id)
#         authclient.auth_plain(self.config['user'], self.config['password']).addCallbacks(lambda response: authed_cb(), return_d.errback)
#         return return_d

    def is_token_active(self):
        return self.token_active


    #need to check if the token has already expired, we have around 60 days. Returns true if token still active
    def check_if_token_not_expired(self):
        current_time = datetime.datetime.now()
        access_token_time = (self.config_timestamp).split(".")[0] # we just want it as yyyy-mm-ddT:hh:mm:ss
        access_token_time = self.createTimestamp(access_token_time);
        delta = current_time - access_token_time
        delta_days = delta.days
        if (delta_days) < 60:
            return True
        else:
            return False

    #this should be a library function somewhere...
    def createTimestamp(self,strTimestamp):
        try:
            return datetime.datetime.strptime(strTimestamp, '%Y-%m-%dT%H:%S:%M')
        except:
            if not ":" in str(strTimestamp):
                strTimestamp = strTimestamp+" 00:00:00"
                return datetime.datetime.strptime(strTimestamp, '%Y-%m-%d %H:%S:%M')
            else:
                pass


    def harvest_all(self):

        harvest_d = Deferred()

        if(self.is_token_active()):
            logging.debug("Service Controller Facebook - Running Facebook Service!")

            def havest_friends_cb(re):
                logging.debug("Service Controller Facebook - Updated Profile")

                def havest_statuses_cb(res):
                    logging.debug("Service Controller Facebook - Updated Status {0}".format(res))
                    harvest_d.callback(True)
                    # def havest_profile_cb(resu):
                    #     logging.debug("Service Controller Facebook - Updated Friends")
                    #     #update every hour
                    #     #reactor.callLater(3600.0, loop_harvester);
                    #     harvest_d.callback(True)

                    # self.harvest_facebook_profile().addCallbacks(havest_profile_cb, lambda failure: logging.error("Facebook Service Controller - Callback Failure: Harvest Profile"))

                self.harvest_facebook_statuses().addCallbacks(havest_statuses_cb, lambda failure: logging.error("Facebook Service Controller - Callback Failure: Harvest Statuses"))

            self.harvest_facebook_friends().addCallbacks(havest_friends_cb, lambda failure: logging.error("Facebook Service Controller - Callback Failure: Harvest Friends"))

        return harvest_d


        ##here are all the facebook methods to havest the data
    def harvest_facebook_profile(self):
        harvest_profile_d = Deferred()

        logging.info('Facebook Service - Getting users Facebook Profile')
        graph = GraphAPI(self.facebook_access_token_long)
        profile = graph.get_object("me")
        timestamp = str(datetime.datetime.now().isoformat('T')).split(".")[0]
        uniq_id = "facebook_profile_for_me"
        object_to_insert = {"@id":uniq_id, "app_object": app_id, "timestamp": timestamp, "facebook_profile": profile}

        #now need to perform the asnc
        def insert_cb(re):
            logging.debug("Facebook Service - Found Facebook Profile information, Added To INDX {0} profile items".format(len(profile)))
            harvest_profile_d.callback(True)

        def insert_cb_fail(re):
            harvest_profile_d.callback(True)

        self.insert_object_to_indx(object_to_insert).addCallbacks(insert_cb, insert_cb_fail)

        return harvest_profile_d

    ##here are all the facebook methods to havest the data
    def harvest_facebook_statuses(self):
        harvest_status_d = Deferred()

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = 0
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_facebook_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the Facebook Config Object.')
            except:
                #print sys.exc_info()
                pass


            logging.info('Facebook Service - Getting users Facebook Statuses')
            graph = GraphAPI(self.facebook_access_token_long)
            profile = graph.get_object("me")
            if len(profile)>1:
                #print "got Profile so should be able to get status"
                facebook_id = str(profile['id'])
                facebook_username = str(profile['name'])
                query = facebook_id#+"/permissions"
                statuses =   graph.get_connections(facebook_id, "statuses", limit=10000) #graph.get_object(query) #
                timestamp = str(datetime.datetime.now().isoformat('T')).split(".")[0]
                statuses = statuses['data']

                #need to make sure that we are not fetching statuses already added...
                latest_status_id = 0
                try:
                    latest_status_id = statuses[0]['id']
                except:
                    pass
                if (latest_status_id > since_id) or (latest_status_id==0):
                    since_id = latest_status_id
                    objects_to_insert = []
                    for status in statuses:

                        uniq_id = "facebook_statuses_"+str(status['id'])
                        facebook_status_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "type": "post", "facebook_status_id":status['id'],
                        "facebook_user_indx": "facebook_user_me", "facebook_user_id":facebook_id}
                        #for each status, get the time
                        facebook_status_obj['facebook_status_text'] = status['message']
                        facebook_status_obj['facebook_status_timestamp'] = str(status['updated_time']).split("+")[0]

                        like_ids = []
                        try:
                            likes = status['likes']['data']
                            totalLikes = len(likes)
                            facebook_status_obj['facebook_status_total_likes'] = str(totalLikes)
                            for like in likes:
                                #construct the facebook user that liked your post
                                uniq_id = "facebook_user_"+str(like['id'])
                                facebook_user_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "type": "user", "facebook_username": like['name'], "facebook_id":like['id']}
                                like_ids.append(uniq_id)
                                objects_to_insert.append(facebook_user_obj)
                        except:
                            pass

                        comment_ids = []
                        try:
                            comments = status['comments']['data']
                            totalcomments = len(comments)
                            facebook_status_obj['facebook_status_total_comments'] = str(totalcomments)
                            for comment in comments:
                                
                                #first create the comment user
                                facebook_comment_obj_id = "facebook_user_"+str(comment['from']['id'])
                                facebook_user_obj = {"@id":facebook_comment_obj_id, "app_object": app_id, "timestamp":timestamp, "type": "user", "facebook_username": comment['from']['name'], "facebook_id":comment['from']['id']}
                                #add it to the indx objects
                                objects_to_insert.append(facebook_user_obj)

                                #create the facebook comment object
                                uniq_id = "facebook_comment_"+comment['id']
                                facebook_comment_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "type": "post", "facebook_user_indx": facebook_comment_obj_id, 
                                "facebook_id":comment['from']['id'], "facebook_username":comment['from']['name']}
                                #for each status, get the time
                                facebook_comment_obj['facebook_comment_text'] = comment['message']
                                facebook_comment_obj['facebook_comment_timestamp'] = str(comment['created_time']).split("+")[0]
                                facebook_comment_obj['like_count'] = comment['like_count']
                                #add it to the indx objects
                                objects_to_insert.append(facebook_comment_obj)
                                #for reference
                                comment_ids.append(uniq_id)
                        except:
                            pass
                        

                        facebook_status_obj['facebook_like_user_ids_indx'] = like_ids
                        facebook_status_obj['facebook_comment_user_ids_indx'] = comment_ids
                        #add it to the indx objects
                        objects_to_insert.append(facebook_status_obj)

                    #then create the user object
                    uniq_id = "facebook_user_me"
                    facebook_user_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "type": "user", "facebook_username": facebook_username, "facebook_id":facebook_id}
                    objects_to_insert.append(facebook_user_obj)
                    #then add all of the extra info
                
                #and create the instagram config
                facebook_config_obj = {"@id": "service_facebook_config", "app_object": app_id, "type":"config", "config_last_updated_at": timestamp,
                "config_for_facebook_user_id": self.facebook_userid, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                "friends_list_size":friends_number, "followers_list_size": followers_number, "since_id":since_id}
                
                objects_to_insert.append(facebook_config_obj)


                #now need to perform the asnc
                def insert_cb(re):
                    logging.info("Facebook Service - Found Statuses, Added To INDX {0} statuses".format(len(statuses)))
                    harvest_status_d.callback(True)

                def insert_cb_fail(re):
                    harvest_status_d.callback(True)

                logging.info("inserting statuses into indx")
                self.insert_object_to_indx(objects_to_insert).addCallbacks(insert_cb, insert_cb_fail)
            else:
                harvest_status_d.callback(True)

        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_instagram_config = {"@id": "service_facebook_config"} 
        logging.info("Searching for facebook_config to check if Popular feed already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_instagram_config))
        def_search.addCallbacks(found_cb, error_cb) 
        
        return harvest_status_d


    def harvest_facebook_friends(self):
        harvest_friends_d = Deferred()

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id = 0
            #let's see if the object has some nice things in it.
            try:
                config_returned = results['data']['service_facebook_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id = int(config_returned['since_id'][0]['@value'])
                logging.info('Found the Facebook Config Object.')
            except:
                #print sys.exc_info()
                pass

            logging.info('Facebook Service - Getting users Facebook Friends')
            graph = GraphAPI(self.facebook_access_token_long)
            #profile = graph.get_object("me")
            #rint profile
            friends_all = graph.get_connections("me", "friends", limit=1000)
            friends = friends_all['data']
            friends_number = len(friends)
            logging.info('Facebook Service - Got users Facebook Friends: {0}'.format(friends_number))
            objects_to_insert = []
            timestamp = str(datetime.datetime.now().isoformat('T')).split(".")[0]
            friend_ids = []
            counter = 0
            friends_objs_to_insert = []
            for friend in friends:
                uniq_id = "facebook_user_"+str(friend['id'])
                friend_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "type": "user", "facebook_user_id": friend['id'], "facebook_username": friend['name']}
                friend_ids.append(uniq_id)
                friends_objs_to_insert.append(friend_obj)

            try:
                #now create the me facebook user friend object
                profile = graph.get_object("me")
                facebook_id = str(profile['id'])
                facebook_username = str(profile['name'])
                uniq_id = "facebook_friends_for_user_me"
                facebook_user_friend_obj = {"@id":uniq_id, "app_object": app_id, "timestamp":timestamp, "faceboob_user_id_indx": "facebook_user_me",
                "facebook_user_id": facebook_id, "facebook_username": facebook_username, "facebook_friends_ids_indx": friend_ids}
                objects_to_insert.append(facebook_user_friend_obj)
            except:
                pass

            #now set the config
            facebook_config_obj = {"@id": "service_facebook_config", "app_object": app_id, "type":"config", "config_last_updated_at": timestamp,
            "config_for_facebook_user_id": facebook_id, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
            "friends_list_size":friends_number, "followers_list_size": followers_number, "since_id":since_id}
            objects_to_insert.append(facebook_config_obj)

            def insertfriends(self):
                if (len(friends_objs_to_insert) > 0):

                    def insert_friend_cb(re):
                        insertfriends(self)

                    def insert_friend_cb_fail(re):
                        insertfriends(self)

                    logging.info("inserting friends into indx")
                    friends_to_add = []
                    pop_point = 0
                    for x in range(0, 100):
                        try:
                            friends_to_add.append(friends_objs_to_insert[x])
                            pop_point += 1
                        except:
                            pass
                    for x in range(0, pop_point):
                        try:
                            friends_objs_to_insert.pop(0)
                        except:
                            pass
                    #friend_object = friends_objs_to_insert[0]
                    #print "friends list length: "+str(len(friends_objs_to_insert))
                    self.insert_object_to_indx(friends_to_add).addCallbacks(insert_friend_cb, insert_friend_cb_fail)
                else:
                    logging.info("All Facebook Friends Added to Indx, will now proceed.")

            #this is a trick as indxclient is a bit nasty with big inserts
            insertfriends(self)

            #now need to perform the asnc
            def insert_cb(re):
                logging.debug("Facebook Service - Found Friends List, Added To INDX {0} Friends".format(len(friends)))
                harvest_friends_d.callback(True)

            def insert_cb_fail(re):
                harvest_friends_d.callback(True)

            logging.info("inserting friends config into indx")
            self.insert_object_to_indx(objects_to_insert).addCallbacks(insert_cb, insert_cb_fail)

        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_facebook_config = {"@id": "service_facebook_config"} 
        logging.info("Searching for facebook_config to check if Popular feed already harvested... ")
        def_search = self.indx_con.query(json.dumps(find_facebook_config))
        def_search.addCallbacks(found_cb, error_cb) 
        
        return harvest_friends_d

    
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
                    logging.debug('INDX insert error in Instagram Service Object: '+str(response))
                    try:
                        service.indx_con.update(service.version, obj).addCallbacks(update_cb, exception_cb)
                        #logging.debug('Twitter Service - Successfully added Objects into Box')
                    except:
                        logging.debug('Instagram Service, error on insert {0}'.format(response))
                        update_d.errback(e.value)
                else:
                    logging.debug('Instagram Service Unknow error: {0}'.format(e.value.read()))
                    update_d.errback(e.value)
            else:
                logging.error("Error updating INDX: {0}".format(e.value))
                update_d.errback(e.value)
        
        logging.debug("in Instagram - Trying to insert into indx...Current diff version: {0} and objects (len) given {1}".format(self.version, len(obj)))
        self.indx_con.update(self.version, obj).addCallbacks(update_cb, exception_cb)
        
        return update_d