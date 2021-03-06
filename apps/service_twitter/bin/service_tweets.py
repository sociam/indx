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
from threading import Timer
from indxclient import IndxClient, IndxClientAuth
from tweepy.streaming import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream
from tweepy import API
from tweepy import Status
from tweepy import Cursor
from twisted.internet.defer import Deferred
from twisted.internet import reactor, threads


appid = "twitter_service"

class TwitterService:

    def __init__(self, credentials, configs, twitter_add_info):
        #logging.debug("Got config items {0}".format(self.config))        
        try:
            if len(credentials)==4 and len(configs)>=4:
                self.credentials = credentials
                self.configs = configs
                self.twitter_add_info = twitter_add_info
                logging.debug('Twitter Service - loading Service Instance')
                self.consumer_key= self.configs['consumer_key']
                self.consumer_secret= self.configs['consumer_secret']
                self.access_token = self.configs['access_token']
                self.access_token_secret = self.configs['access_token_secret']
                self.twitter_username = self.configs['twitter_username']
                self.since_id = 0
                self.version = 0
                self.batch = []
                self.batch_users = []
                self.batch_tweet_locations = []
                self.batch_user_locations = []
                self.batch_hashtags = []
                self.tweet_count = 0
                self.tweet_count_total=0
                
                #set the auth access control
                self.auth = OAuthHandler(self.consumer_key, self.consumer_secret)
                self.auth.set_access_token(self.access_token, self.access_token_secret)
            else:
                raise Exception("Credentials or Configs missing, credentials: {0}, configs: {1}".format(credentials, configs))
        except Exception as e:
            logging.error("Could not start TwitterService, check config details - params might be missing, exception: {0}".format(e))

    
    def get_indx(self):

        return_d = Deferred()

        def authed_cb(): 
            logging.debug("in service_tweets - Authed Callback")
            logging.debug("in service_tweets - get_indx authclient Auth status: {0}".format(authclient.is_authed))
        
            def token_cb(token):
                self.indx_con = IndxClient(self.credentials['address'], self.credentials['box'], appid, token = token, client = authclient.client)
                return_d.callback(True)

            authclient.get_token(self.credentials['box']).addCallbacks(token_cb, return_d.errback)
         
        def authed_cb_fail(re): 
            logging.debug("in service tweets - get_indx/authed_cb failed for reason {0}".format(re))
            return_d.errback   

        logging.debug("in service_tweets - get_indx")    
        authclient = IndxClientAuth(self.credentials['address'], appid)
        authclient.auth_plain(self.credentials['username'], self.credentials['password']).addCallbacks(lambda response: authed_cb(), authed_cb_fail)

        return return_d
    

    def stop_and_exit_service(self):
        logging.debug('Twitter Service - HARD QUIT - TWITTER SERVICE')
        sys.exit()
   

    def iso_timestamp(self, date_st):
        try:
            if "+" in str(date_st):
                #to deal with python 2.7...
                date_st_wo_year = date_st.split(" +")[0]
                year = date_st.split(" +")[1]
                year = year.split(" ")[1]
                date_st = str(date_st_wo_year)+" "+str(year)
                date_st = datetime.strptime(date_st,'%a %b %d %H:%M:%S %Y')
            else:
                date_st = datetime.strptime(date_st, '%Y-%m-%d %H:%S:%M')
            return date_st.isoformat('T')
        except:
            print sys.exc_info()
            return date_st

    #this checks and inserts both the network and status objects into indx
    def load_additional_harvesters(self, additional_params, service):
        harvesters_d = Deferred()

        try:
            #if the user want's to
            is_get_status = additional_params['twitter_status']
            #establish a search connection as welll...
            if "True" in str(is_get_status):
                logging.info("Harvesting Own Tweets on Timeline")
                #threading.Timer(15, self.run_timeline_harvest, args=(service,)).start()

                def status_cb(re):
                    logging.debug("status_cb harvest async worked {0}".format(re))

                    #check that the insert has finished..
                    if re:
                        #now to avoid any HTTP 500 server errors, next the next call...
                        try:
                            is_get_network = additional_params['twitter_network']
                            if "True" in str(is_get_network):
                                #print "GETTING NETWORK"
                                logging.info("Harvesting Friends List")

                                def network_cb(re):
                                    logging.debug("network_cb harvest async worked {0}".format(re))
                                    harvesters_d.callback(True)

                                def network_cb_fail(re):
                                    logging.error("network_cb harvest async failed {0}".format(re))
                                    harvesters_d.errback   

                                #ASYNC CALL!
                                self.harvest_network(service).addCallbacks(network_cb, network_cb_fail)
                        except:
                            logging.error("couldnt get Twitter friends network")

                    #harvesters_d.callback(True)

                def status_cb_fail(re):
                    logging.error("status_cb harvest async failed {0}".format(re))
                    #harvesters_d.errback 

                #ASYNC CALL!
                self.run_timeline_harvest(service).addCallbacks(status_cb, status_cb_fail)
        except:
            logging.error("couldnt get status "+str(sys.exc_info()))

        return harvesters_d


    #this needs to call the database to get the search criteria...    
    def get_search_criteria(self):
        search_terms = []
        username = self.configs['twitter_username']
        words = self.configs['twitter_search_words'].split(",")
        search_terms.append(username)
        for word in words:
            search_terms.append(word)
        return words


    def get_tweets(self, words_to_track):
        stream_d = Deferred()

        l = INDXListener(self)

        self.stream = Stream(self.auth, l)
        try:
            if len(words_to_track) > 0:
                logging.debug('Twitter Service - Stream Open and Storing Tweets')

                self.stream.filter(track=words_to_track) #.addCallbacks(stream_cb, stream_d.errback)

                if not self.stream.running:
                    
                    def update_cb(re):
                        logging.debug("updated INDX with tweets, result from Update was: {0}".format(re))
                        self.batch = []

                        #now we need to add the users list...
                        def update_users_cb(re):
                            logging.debug("updated INDX with tweet_users, result from Update was: {0}".format(re))
                            self.batch_users = []
                            #self.get_tweets(words_to_track)

                            def update_tweet_locations_cb(re):
                                logging.debug("updated INDX with tweet_locations, result from Update was: {0}".format(re))
                                self.batch_tweet_locations = []

                                def update_user_locations_cb(re):
                                    logging.debug("updated INDX with user_locations, result from Update was: {0}".format(re))
                                    self.batch_user_locations = []


                                    def update_hashtags_cb(re):
                                        logging.debug("updated INDX with hashtags, result from Update was: {0}".format(re))
                                        self.batch_user_locations = []
                                   
                                        logging.debug('Service Tweets - INDX stored streamed tweets, now harvesting stream again')
                                        stream_d.callback(True)

                                    def update_hashtag_cb_fail(re):
                                        logging.error("timeline harvest async failed {0}".format(re))
                                        stream_d.errback

                                
                                    logging.debug("Trying to Insert new batch of Hashtags with a batch size of: {0}".format(len(self.batch_hashtags)))
                                    self.insert_object_to_indx(self, self.batch_hashtags).addCallbacks(update_hashtags_cb, update_hashtag_cb_fail)
                            
                                def update_user_locations_cb_fail(re):
                                    logging.error("timeline harvest async failed {0}".format(re))
                                    stream_d.errback


                                logging.debug("Trying to Insert new batch of Tweet Locations with a batch size of: {0}".format(len(self.batch_user_locations)))
                                self.insert_object_to_indx(self, self.batch_user_locations).addCallbacks(update_user_locations_cb, update_user_locations_cb_fail)
                            

                            def update_tweet_locations_cb_fail(re):
                                logging.error("timeline harvest async failed {0}".format(re))
                                stream_d.errback

                            logging.debug("Trying to Insert new batch of Tweet Locations with a batch size of: {0}".format(len(self.batch_tweet_locations)))
                            self.insert_object_to_indx(self, self.batch_tweet_locations).addCallbacks(update_tweet_locations_cb, update_tweet_locations_cb_fail)


                        def update_users_cb_fail(re):
                            logging.error("timeline harvest async failed {0}".format(re))
                            stream_d.errback
                        
                        logging.debug("Trying to Insert new batch of Users with a batch size of: {0}".format(len(self.batch_users)))
                        self.insert_object_to_indx(self, self.batch_users).addCallbacks(update_users_cb, update_users_cb_fail)
                    

                    def update_cb_fail(re):
                        logging.error("timeline harvest async failed {0}".format(re))
                        #stream_d.errback

                    logging.debug("Trying to Insert new batch of Tweets with a batch size of: {0}".format(len(self.batch)))                    
                    self.insert_object_to_indx(self, self.batch).addCallbacks(update_cb, update_cb_fail)

        except:
            logging.error('Service Tweets - error, Twitter Stream encountered an error {0}'.format(sys.exc_info()))

        return stream_d


    #datamodel is {timestamp: {friends:[friend_id]}
    def harvest_network(self, service):
        
        harvest_d = Deferred()

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id_found = 0
            try:
                config_returned = results['data']['service_twitter_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id_found = int(config_returned['timeline_since_id'][0]['@value'])
                logging.info('Found the Twitter Config Object.')
                logging.info("Old Config: {0} Friends and {1} Followers".format(friends_number, followers_number))
            except:
                #print sys.exc_info()
                pass

            try:
                self.api = tweepy.API(service.auth)
                friends_list = self.api.friends_ids(service.twitter_username)
                followers_list = self.api.followers_ids(service.twitter_username)
                current_timestamp = str(time.time()).split(".")[0] #str(datetime.now())
                timestamp = str(datetime.now().isoformat('T')).split(".")[0]
                uniq_id = "twitter_user_network_at_"+current_timestamp
                network_objs = {"@id":uniq_id, "app_object": appid, "twitter_username": service.twitter_username, "timestamp": timestamp, "friends_list": friends_list, "followers_list": followers_list}
                new_friends_number = len(friends_list)
                new_followers_number = len(followers_list)

                if (friends_number != new_friends_number) or (followers_number != new_followers_number):
                    logging.info("Twitter Config is old. Found {0} Friends and {1} Followers. Will Update".format(new_friends_number, new_followers_number))
                    #print friends_objs
                    #for friend in friends_list:
                        #print friend
                    #now append the results

                    #also create the service_twitter_config obiect:
                    twitter_config_obj = {"@id": "service_twitter_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp, 
                    "config_for_twitter_user": service.twitter_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                    "friends_list_size": str(len(friends_list)), "followers_list_size": str(len(followers_list)), "timeline_since_id": since_id_found}

                    #give them to indx to add...
                    objects_for_indx= []
                    objects_for_indx.append(network_objs)
                    objects_for_indx.append(twitter_config_obj)


                    def update_cb(re):
                        logging.debug("network harvest async worked {0}".format(re))
                        harvest_d.callback(True)

                    def update_cb_fail(re):
                        logging.error("network harvest async failed {0}".format(re))
                        harvest_d.errback

                    self.insert_object_to_indx(service, objects_for_indx).addCallbacks(update_cb, update_cb_fail)
                else:
                    logging.info("Twitter Config is upto date. No need to update INDX")
                    harvest_d.callback(True)
            except:
                logging.debug('harvest network failed')
                harvest_d.callback(True)

        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_twitter_config = {"@id": "service_twitter_config"} 
        logging.info("Searching for twitter_config to check if network already harvested... ")
        def_search = service.indx_con.query(json.dumps(find_twitter_config))
        def_search.addCallbacks(found_cb, error_cb)

        return harvest_d
    




    def run_timeline_harvest(self, service):

        #first check if INDX has already got the latest version...
        #to-do
        timeline_harvest_cb = Deferred()

        def found_cb(results):
            friends_number = 0
            followers_number = 0
            since_id_found = 0
            try:
                config_returned = results['data']['service_twitter_config']
                friends_number = int(config_returned['friends_list_size'][0]['@value'])
                followers_number = int(config_returned['followers_list_size'][0]['@value'])
                since_id_found = int(config_returned['timeline_since_id'][0]['@value'])

                logging.info('Found the Twitter Config Object.')
                logging.info("Old Config: {0} Since ID".format(since_id_found))
            except:
                #print sys.exc_info()
                pass


            #if sinceIs found, then we need to check index to see if that object has been added...
            try:
                #logging.debug('Getting Users Twitter Timeline since the last Id of {0}'.format(service.since_id))
                self.api = tweepy.API(service.auth)
                first_pass = False
                second_pass = False
                status_timeline = []
                status_timeline_pages = []
                try:
                    if since_id_found > 0:
                        for page in Cursor(self.api.user_timeline,  id=service.twitter_username, since_id=since_id_found).pages():
                            status_timeline_pages.append(page)
                        logging.info("Previous Status Objects Found, Looking for statuses from ID {0}".format(since_id_found))
                        second_pass = True
                    else:
                        status_timeline_pages = []
                        logging.info("No Previous Status Objects Found, Getting all status backlog (it's working, just be patient...)")
                        page_counter = 0
                        for page in Cursor(self.api.user_timeline, id=service.twitter_username).pages():
                            status_timeline_pages.append(page)
                            logging.info("got page {0}".format(page_counter))
                            page_counter += 1
                        logging.info("Got {0} Pages of statuses".format(len(status_timeline_pages)))
                        first_pass = True
                except Exception as e:
                    logging.info('Could not get Twitter Status Tweets, Probably no updates as of yet...')
                    #logging.error(e)

                #print "GOT STATUS TIMELINE: "+str(len(status_timeline))
                #have we got any statuses?
                if (len(status_timeline_pages)>0): 

                    if second_pass:
                        logging.info("Found some new statuses. Will insert the latest....")
                    
                    # #if we are dealing with the first pass of statuses, then do some processing
                    # if first_pass:
                    status_batch_for_indx = []
                    status_objects_already_found = {}
                    for page in status_timeline_pages:
                        for status in page:
                            #tweet = json.loads(status)
                            #print str(status)
                            tweet_indx = {}
                            tweet_indx['@id'] = "twitter_status_tweet_id_"+unicode(status.id)
                            tweet_indx['type'] = "post"
                            tweet_indx['tweet_id'] = unicode(status.id)
                            tweet_indx['app_object'] = appid
                            text = unicode(status.text)
                            tweet_indx['tweet_text'] = text
                            tweet_indx['tweet_user_id'] = status.author.name
                            tweet_indx['created_at'] = self.iso_timestamp(str(status.created_at))
                            tweet_indx['retweet_count'] = status.retweet_count

                            #find anything about the tweet user (Your name might have changed, good to check..)
                            try:
                                tweet_user = status.author
                                twitter_user_indx = {}
                                twitter_user_indx['@id'] = "twitter_user_me" #+unicode(tweet_user.id)
                                twitter_user_indx['type'] = "user"
                                twitter_user_indx['twitter_user_id'] = unicode(tweet_user.id)
                                twitter_user_indx['twitter_user_name'] = tweet_user.name
                                twitter_user_indx['account_created_at'] = self.iso_timestamp(str(tweet_user.created_at))
                                twitter_user_indx['followers_count'] = tweet_user.followers_count
                                twitter_user_indx['friends_count'] = tweet_user.friends_count
                                twitter_user_indx['statuses_count'] = tweet_user.statuses_count
                                twitter_user_indx['profile_image_url'] = tweet_user.profile_image_url

                                #update the status object...
                                tweet_indx['tweet_user_id_indx'] = twitter_user_indx['@id']
                                try:
                                    if status_objects_already_found[twitter_user_indx['@id']]:
                                        pass
                                    #found it so, do nothing
                                except:
                                    status_objects_already_found[twitter_user_indx['@id']] = True
                                    status_batch_for_indx.append(twitter_user_indx)

                            except:
                                pass


                            #now find anything about where the tweet was made...
                            try:

                                obj_id = unicode(tweet_user['location'].replace(",","_").replace(" ",""))
                                if len(obj_id) > 2:
                                    obj_id = "twitter_user_location_id_"+obj_id
                                    twitter_user_location_indx = {}
                                    twitter_user_location_indx['@id'] = obj_id
                                    twitter_user_location_indx['type'] = "location"
                                    twitter_user_location_indx['location'] = twitter_user_indx['location']

                                    #now the status can be linked to the location...
                                    twitter_user_indx['twitter_user_location_indx'] = twitter_user_location_indx['@id']
                                    # make a check to see if the object is areadly there
                                    try:
                                        if status_objects_already_found[twitter_user_location_indx['@id']]:
                                            pass
                                        #found it so, do nothing
                                    except:
                                        status_objects_already_found[twitter_user_location_indx['@id']] = True
                                        status_batch_for_indx.append(twitter_user_location_indx)
                            except:
                                pass

                            #finally add the tweet
                            status_batch_for_indx.append(tweet_indx)

                            #get the latest since ID
                            if int(tweet_indx['tweet_id']) > since_id_found:
                                since_id_found = int(tweet_indx['tweet_id'])

                        #now create the config obj...
                        timestamp = str(datetime.now().isoformat('T')).split(".")[0]
                        twitter_config_obj = {"@id": "service_twitter_config", "app_object": appid, "type":"config", "config_last_updated_at": timestamp, 
                        "config_for_twitter_user": service.twitter_username, "friends_list_generated_at": timestamp, "follower_list_generated_at": timestamp,
                        "friends_list_size": friends_number, "followers_list_size": followers_number, "timeline_since_id": since_id_found}
                        #and add it to commit to indx
                        status_batch_for_indx.append(twitter_config_obj)


                    def update_cb(re):
                        logging.debug("timeline harvest async worked {0}".format(re))
                        timeline_harvest_cb.callback(True)

                    def update_cb_fail(re):
                        logging.error("timeline harvest async failed {0}".format(re))
                        timeline_harvest_cb.errback

                    self.insert_object_to_indx(service, status_batch_for_indx).addCallbacks(update_cb, update_cb_fail)
                
                else:
                    timeline_harvest_cb.callback(True)

            except:
                logging.error('twitter timeline harvest failed {0}'.format(sys.exc_info()))
                timeline_harvest_cb.callback(True)


        def error_cb(re):
            found_cb()

        def_search = Deferred()
        find_twitter_config = {"@id": "service_twitter_config"} 
        logging.info("Searching for twitter_config to check if network already harvested... ")
        def_search = service.indx_con.query(json.dumps(find_twitter_config))
        def_search.addCallbacks(found_cb, error_cb)

        return timeline_harvest_cb


    
    def insert_object_to_indx(self, service, obj):

        update_d = Deferred()

        def update_cb(resp):
            service.version = resp['data']['@version']
            logging.debug("Succesfully Updated INDX with Objects in update_cb, new diff version of {0}".format(service.version))
            #logging.debug("Inserted Object into INDX: ".format(resp))
            update_d.callback(True)
            #return update_d
            #time.sleep(2)

        def exception_cb(e, service=service, obj=obj):
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
        
        logging.debug("in service_tweets - Trying to insert into indx...Current diff version: {0} and objects (len) given {1}".format(service.version, len(obj)))
        service.indx_con.update(service.version, obj).addCallbacks(update_cb, exception_cb)
        
        return update_d




class INDXListener(StreamListener):
    """ A listener handles tweets are the received from the stream.
    This is a basic listener that just prints received tweets to stdout.

    """

    def __init__(self, twitter_serv):
        self.service = twitter_serv 
        self.tweet_count = 0
        #self.stream_d = Deferred()      


    def on_data(self, tweet_data):

        """ Assert the tweet into INDX.
        If the version is incorrect, the correct version will be grabbed and the update re-sent.
        
        tweet -- The tweet to assert into the box.
        """
        #data_d = Deferred()

        global appid

        try:
            tweet = json.loads(tweet_data)
            #print tweet
            #logging.debug("{0}, {1}".format(type(tweet), tweet))
            if not tweet.get('text'):
                # TODO: log these for provenance?                
                #logging.debug("Skipping informational message: '{0}'".format(tweet_data.encode("utf-8")))
                return
            #logging.debug("Adding tweet: '{0}'".format(tweet['text'].encode("utf-8")))            
            try:

                tweet_found = False
                try:
                    tweet_indx = {}
                    tweet_indx['@id'] = "twitter_tweet_id_"+unicode(tweet['id'])
                    tweet_indx['type'] = "post"
                    tweet_indx['tweet_id'] = unicode(tweet['id'])
                    tweet_indx['app_object'] = appid
                    tweet_indx['tweet_lang'] = tweet['lang']
                    text = unicode(tweet['text'])
                    tweet_indx['tweet_text'] = text
                    tweet_indx['created_at'] = self.iso_timestamp(str(tweet['created_at']))
                    tweet_indx['was_retweeted'] = tweet['retweeted']
                    try:
                        tweet_indx['in_reply_to_status_id'] = tweet['in_reply_to_status_id']
                    except:
                        pass
                    tweet_indx['tweet_lang'] = tweet['lang']
                    tweet_found = True
                except:
                    pass


                tweet_location_found = False
                try:
                    place = tweet['place']
                    tweet_location_indx = {}
                    tweet_location_indx['@id'] = "tweet_location_id_"+unicode(place['id'])
                    tweet_location_indx['type'] = "location"
                    tweet_location_indx['location_country_code'] = place['country_code']
                    tweet_location_indx['location_country'] = place['country']
                    tweet_location_indx['location_name'] = place['name']
                    tweet_location_indx['location_place_type'] = place['place_type']
                    try:
                        coordinates = place['bounding_box']['coordinates']
                        tweet_location_indx['location_geo_lat'] = coordinates[0][0] 
                        tweet_location_indx['location_geo_long'] = coordinates[0][1]
                    except:
                        pass
                    tweet_location_found = True

                except:
                    pass


                #extract entities....
                tweet_hashtag_indx_found = False
                tweet_hashtag_indx_list = []
                try:
                    entities = tweet['entities']
                    hashtags = entities['hashtags']
                    for hashtag in hashtags:
                        hashtag_name = hashtag['text']
                        tweet_hashtag_indx = {}
                        tweet_hashtag_indx['@id'] = "twitter_hashtag_id_"+unicode(hashtag_name)
                        tweet_hashtag_indx['type'] = "tag"
                        tweet_hashtag_indx['hashtag_name'] = hashtag_name
                        #add the hashtag to the associated tweet
                        tweet_hashtag_indx_list.append(tweet_hashtag_indx)
                    tweet_indx['hashtags'] = tweet_hashtag_indx_list 
                    tweet_hashtag_indx_found = True
                except:
                    pass


                tweet_user_found = False 
                try:
                    tweet_user = tweet['user']
                    twitter_user_indx = {}
                    twitter_user_indx['@id'] = "twitter_user_id_"+unicode(tweet_user['id'])
                    twitter_user_indx['type'] = "user"
                    twitter_user_indx['twitter_user_id'] = unicode(tweet_user['id'])
                    twitter_user_indx['twitter_user_name'] = tweet_user['name']
                    twitter_user_indx['screen_name'] = "@"+str(tweet_user['screen_name'])
                    twitter_user_indx['account_created_at'] = self.iso_timestamp(str(tweet_user['created_at']))
                    twitter_user_indx['followers_count'] = tweet_user['followers_count']
                    twitter_user_indx['friends_count'] = tweet_user['friends_count']
                    twitter_user_indx['statuses_count'] = tweet_user['statuses_count']
                    twitter_user_indx['profile_image_url'] = tweet_user['profile_image_url']
                    twitter_user_indx['description'] = tweet_user['description']

                    tweet_user_found = True
                except:
                    pass

                tweet_user_location_found = False
                try:
                    obj_id = unicode(tweet_user['location'].replace(",","_").replace(" ",""))
                    if len(obj_id) > 2:
                        obj_id = "twitter_user_location_id_"+obj_id
                        twitter_user_location_indx = {}
                        twitter_user_location_indx['@id'] = obj_id
                        twitter_user_location_indx['type'] = "location"
                        twitter_user_location_indx['location'] = tweet_user['location']
                        tweet_user_location_found = True
                except:
                    pass


                #print twitter_user_indx
                self.service.tweet_count += 1
                self.service.tweet_count_total +=1

                #update links between objects
                tweet_indx['twitter_user_id'] = tweet_user['id']
                tweet_indx['twitter_user_indx_id'] = twitter_user_indx['@id'] 

                #INSERT INTO BATCHES...

                if tweet_location_found:
                    tweet_indx['tweet_location_indx_id'] = tweet_location_indx['@id'] 
                    self.service.batch_tweet_locations.append(tweet_location_indx)
                if tweet_user_location_found:
                    twitter_user_indx['twitter_user_location_indx_id'] = twitter_user_location_indx['@id']
                    self.service.batch_user_locations.append(twitter_user_location_indx)
                if tweet_hashtag_indx_found:
                    for hashtag_obj in tweet_hashtag_indx_list:
                        self.service.batch_hashtags.append(hashtag_obj)
                if tweet_found:
                    self.service.batch.append(tweet_indx)
                if tweet_user_found:
                    self.service.batch_users.append(twitter_user_indx)

            except:
                print sys.exc_info()

            if len(self.service.batch) > 10:
                #data_d = Deferred()
                #data_d.callback(True)
                logging.info('Service Tweets - Disconnecting Twitter Stream to do update')
                self.service.stream.disconnect()
        
            # #need to give time to reset the stream...    
            # if self.service.tweet_count > 150:
            #     self.service.tweet_count = 0
            #     self.service.stream.disconnect()
            #     logging.debug('Service Tweets - Disconnecting Twitter Stream, total tweets harvsted since boot {0}'.format(self.service.tweet_count_total))
                
        
        except Exception as e:
            logging.error("Service Tweets - on_data error {0}".format(e))
        #     if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
        #         if e.code == 409: # 409 Obsolete
        #             response = e.read()
        #             json_response = json.loads(response)
        #             self.service.version = json_response['@version']
        #             self.on_data(tweet_data) # try updating again now the version is correct
        #         else:
        #             logging.error('Twitter Service - Streaming Error {0}'.format(e.read()))
        #     else:
        #         #print "didnt insert tweet"
        #         logging.error("Error updating INDX: {0}".format(e))
        #         sys.exit(0)                    
        #return True
        #return data_d


    def insert_tweets(self, obj):

        insert_d = Deferred()

        def insert_cb(re):
            logging.debug("twitter service - insert_tweets batch insert worked {0}".format(re))
            insert_d.callback(False)

        def insert_cb_fail(re):
            logging.debug("twitter service - insert_tweets batch async failed {0}".format(re))
            insert_d.errback

        self.service.insert_object_to_indx(self.service, obj).addCallbacks(insert_cb, insert_cb_fail)
        return insert_d

    def on_error(self, status):
        logging.debug('Twitter Service - Streaming Error From Twitter API {0}'.format(status))

    def iso_timestamp(self, date_st):
        try:
            if "+" in str(date_st):
                #to deal with python 2.7...
                date_st_wo_year = date_st.split(" +")[0]
                year = date_st.split(" +")[1]
                year = year.split(" ")[1]
                date_st = str(date_st_wo_year)+" "+str(year)
                date_st = datetime.strptime(date_st,'%a %b %d %H:%M:%S %Y')
            else:
                date_st = datetime.strptime(date_st, '%Y-%m-%d %H:%S:%M')
            return date_st.isoformat('T')
        except:
            print sys.exc_info()
            return date_st