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
from twisted.internet.defer import Deferred

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
            logging.info("in service_tweets - Authed Callback")
            logging.info("in service_tweets - get_indx authclient Auth status: {0}".format(authclient.is_authed))
        
            def token_cb(token):
                self.indx_con = IndxClient(self.credentials['address'], self.credentials['box'], appid, token = token, client = authclient.client)
                return_d.callback(True)

            authclient.get_token(self.credentials['box']).addCallbacks(token_cb, return_d.errback)
         
        def authed_cb_fail(re): 
            logging.info("in service tweets - get_indx/authed_cb failed for reason {0}".format(re))
            return_d.errback   

        logging.info("in service_tweets - get_indx")    
        authclient = IndxClientAuth(self.credentials['address'], appid)
        authclient.auth_plain(self.credentials['username'], self.credentials['password']).addCallbacks(lambda response: authed_cb(), authed_cb_fail)

        return return_d
    

    def stop_and_exit_service(self):
        logging.debug('Twitter Service - HARD QUIT - TWITTER SERVICE')
        sys.exit()
   

    def run_main_services(self):
        #now get the tweets
        #main_services_d = Deferred()
        try:            
            #now get the stream for a while...
            words_to_search = self.get_search_criteria()

            #while(stream_active):
            def stream_cb(re):
                logging.debug("stream_cb harvest async worked {0}".format(re))
                self.get_tweets(words_to_search).addCallbacks(stream_cb, stream_cb_fail)

            def stream_cb_fail(re):
                logging.error("stream_cb harvest async failed {0}".format(re))
                        
            self.get_tweets(words_to_search).addCallbacks(stream_cb, stream_cb_fail)
            #the stream probably crashed out - Not my fault by silly twitter...
            #if this is the case, it's a good time harvest the user again, then restart the stream!
            #self.run_additional_services()
            #self.run_main_services()
        except:
            logging.debug('Service Tweets - Could not run main service due to error: {0}'.format(sys.exc_info()))

        #return main_services_d

    def run_additional_services(self):
        #see if other harvesters needed (indx con needed to sumbit data)
        self.load_additional_harvesters(self.twitter_add_info, self)


#this checks and inserts both the network and status objects into indx
    def load_additional_harvesters(self, additional_params, service):
        harvesters_d = Deferred()

        try:
            #if the user want's to
            is_get_status = additional_params['twitter_status']
            #establish a search connection as welll...
            if "True" in str(is_get_status):
                logging.debug("Adding Twitter Status Harvester/Timer")
                #threading.Timer(15, self.run_timeline_harvest, args=(service,)).start()

                def status_cb(re):
                    logging.info("status_cb harvest async worked {0}".format(re))

                    #check that the insert has finished..
                    if re:
                        #now to avoid any HTTP 500 server errors, next the next call...
                        try:
                            is_get_network = additional_params['twitter_network']
                            if "True" in str(is_get_network):
                                #print "GETTING NETWORK"
                                logging.debug("Adding Twitter Network Harvester")

                                def network_cb(re):
                                    logging.info("network_cb harvest async worked {0}".format(re))
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
                    harvesters_d.errback 

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
                logging.info('Twitter Service - Stream Open and Storing Tweets')

                self.stream.filter(track=words_to_track) #.addCallbacks(stream_cb, stream_d.errback)

                if not self.stream.running:
                    
                    def update_cb(re):
                        logging.info("updated INDX with tweets, result from Update was: {0}".format(re))
                        self.batch = []

                        #now we need to add the users list...
                        def update_users_cb(re):
                            logging.info("updated INDX with tweet_users, result from Update was: {0}".format(re))
                            self.batch_users = []
                            logging.info('Service Tweets - INDX stored streamed tweets, now harvesting stream again')
                            #self.get_tweets(words_to_track)
                            stream_d.callback(True)

                        def update_users_cb_fail(re):
                            logging.error("timeline harvest async failed {0}".format(re))
                            stream_d.errback
                        
                        logging.info("Trying to Insert new batch of Users with a batch size of: {0}".format(len(self.batch_users)))
                        self.insert_object_to_indx(self, self.batch_users).addCallbacks(update_users_cb, update_users_cb_fail)
                    

                    def update_cb_fail(re):
                        logging.error("timeline harvest async failed {0}".format(re))
                        stream_d.errback

                    logging.info("Trying to Insert new batch of Tweets with a batch size of: {0}".format(len(self.batch)))                    
                    self.insert_object_to_indx(self, self.batch).addCallbacks(update_cb, update_cb_fail)

        except:
            logging.error('Service Tweets - error, Twitter Stream encountered an error {0}'.format(sys.exc_info()))

        return stream_d


    #datamodel is {timestamp: {friends:[friend_id]}
    def harvest_network(self, service):
        
        harvest_d = Deferred()

        try:
            self.api = tweepy.API(service.auth)
            friends_list = self.api.followers_ids(service.twitter_username)
            current_timestamp = str(datetime.now())
            uniq_id = "friends_at_"+current_timestamp
            friends_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "friends_list": friends_list}
            #print friends_objs
            #for friend in friends_list:
                #print friend
            #now append the results
            def update_cb(re):
                logging.debug("network harvest async worked {0}".format(re))
                harvest_d.callback(True)

            def update_cb_fail(re):
                logging.error("network harvest async failed {0}".format(re))
                harvest_d.errback

            self.insert_object_to_indx(service, friends_objs).addCallbacks(update_cb, update_cb_fail)
        except:
            logging.debug('harvest network failed')

        return harvest_d
    




    def run_timeline_harvest(self, service):

        #first check if INDX has already got the latest version...
        #to-do
        timeline_harvest_cb = Deferred()

        try:
            #logging.info('Getting Users Twitter Timeline since the last Id of {0}'.format(service.since_id))
            self.api = tweepy.API(service.auth)
            try:
                if service.since_id > 0:
                    status_timeline = self.api.user_timeline(service.twitter_username, service.since_id)
                else:
                    status_timeline = self.api.user_timeline(service.twitter_username)
            except:
                logging.debug('COULDNT GET STATUS, PROBABLY NO UPDATES AS OF YET...')
                status_timeline = {}
            #print "GOT STATUS TIMELINE: "+str(len(status_timeline))
            #have we got any statuses?
            if len(status_timeline)>0:
                #guess so - lets commit these to INDX
                #update since_id
                service.since_id = status_timeline[len(status_timeline)-1].id
                #print "NEW SINCE_ID :"+str(service.since_id)
                current_timestamp = str(datetime.now())
                uniq_id = "timeline_at_"+current_timestamp
                status_list = []
                for x in status_timeline:
                    #convert date
                    timestamp =  x.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    status = {"@id": x.id, "user": x.author.name, "created_at": timestamp, "text": x.text,  "coordinates": x.coordinates, "retweet_count": x.retweet_count}
                    status_list.append(status)
                status_objs = {"@id":uniq_id, "app_object": appid, "timestamp":current_timestamp, "since_id": service.since_id, "status_list": status_list}
                #print status_objs
            #now append the results

                def update_cb(re):
                    logging.info("timeline harvest async worked {0}".format(re))
                    timeline_harvest_cb.callback(True)

                def update_cb_fail(re):
                    logging.error("timeline harvest async failed {0}".format(re))
                    timeline_harvest_cb.errback

                self.insert_object_to_indx(service, status_objs).addCallbacks(update_cb, update_cb_fail)
        except:
            logging.error('twitter timeline harvest failed {0}'.format(sys.exc_info()))

        return timeline_harvest_cb


    
    def insert_object_to_indx(self, service, obj):

        update_d = Deferred()

        def update_cb(resp):
            service.version = resp['data']['@version']
            logging.info("Succesfully Updated INDX with Objects in update_cb, new diff version of {0}".format(service.version))
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
        
        logging.info("in service_tweets - Trying to insert into indx...Current diff version: {0} and objects (len) given {1}".format(service.version, len(obj)))
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
                #logging.info("Skipping informational message: '{0}'".format(tweet_data.encode("utf-8")))
                return
            #logging.info("Adding tweet: '{0}'".format(tweet['text'].encode("utf-8")))            
            try:
                tweet_indx = {}
                tweet_indx['@id'] = unicode(tweet['id'])
                tweet_indx['app_object'] = appid
                tweet_indx['tweet_lang'] = tweet['lang']
                text = unicode(tweet['text'])
                tweet_indx['tweet_text'] = text
                tweet_indx['created_at'] = tweet['created_at']
                tweet_indx['was_retweeted'] = tweet['retweeted']
                tweet_indx['coordinates'] = tweet['coordinates']

                tweet_user = tweet['user']
                tweet_indx['tweet_user_id'] = tweet_user['id']

                twitter_user_indx = {}
                twitter_user_indx['@id'] = unicode(tweet_user['id'])
                twitter_user_indx['twitter_user_name'] = tweet_user['name']
                twitter_user_indx['account_created_at'] = tweet_user['created_at']
                twitter_user_indx['followers_count'] = tweet_user['followers_count']
                twitter_user_indx['friends_count'] = tweet_user['friends_count']
                twitter_user_indx['statuses_count'] = tweet_user['statuses_count']

                #print twitter_user_indx
                self.service.tweet_count += 1
                self.service.tweet_count_total +=1
                #print text
                self.service.batch.append(tweet_indx)
                self.service.batch_users.append(twitter_user_indx)

            except:
                print sys.exc_info()

            if len(self.service.batch) > 25:
                #data_d = Deferred()
                #data_d.callback(True)
                logging.info('Service Tweets - Disconnecting Twitter Stream to do update')
                self.service.stream.disconnect()
        
            #need to give time to reset the stream...    
            if self.service.tweet_count > 100:
                self.service.tweet_count = 0
                self.service.stream.disconnect()
                logging.info('Service Tweets - Disconnecting Twitter Stream, total tweets harvsted since boot {0}'.format(self.service.tweet_count_total))
                
        
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
            logging.info("twitter service - insert_tweets batch insert worked {0}".format(re))
            insert_d.callback(False)

        def insert_cb_fail(re):
            logging.info("twitter service - insert_tweets batch async failed {0}".format(re))
            insert_d.errback

        self.service.insert_object_to_indx(self.service, obj).addCallbacks(insert_cb, insert_cb_fail)
        return insert_d

    def on_error(self, status):
        logging.debug('Twitter Service - Streaming Error From Twitter API {0}'.format(status))