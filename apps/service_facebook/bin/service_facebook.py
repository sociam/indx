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
            logging.debug('Facebook Service - Token is active still. Great News!')
            self.token_active = True

    def get_indx(self):
        return_d = Deferred()
#        self.indx_con = IndxClient(self.config['address'], self.config['box'], self.config['user'], self.config['password'], app_id)
        def authed_cb(): 
            def token_cb(token):
                self.indx_con = IndxClient(self.config['address'], self.config['box'], app_id, token = token)
                return_d.callback(True)

            authclient.get_token(self.config['box']).addCallbacks(token_cb, return_d.errback)
            
        authclient = IndxClientAuth(self.config['address'], app_id)
        authclient.auth_plain(self.config['user'], self.config['password']).addCallbacks(lambda response: authed_cb(), return_d.errback)
        return return_d

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


        ##here are all the facebook methods to havest the data
    def harvest_facebook_profile(self):
        logging.debug('Facebook Service - Getting users Facebook Profile')
        graph = facebook.GraphAPI(self.facebook_access_token_long)
        profile = graph.get_object("me")
        current_timestamp = str(datetime.datetime.now())
        uniq_id = "facebook_profile_at_"+current_timestamp
        object_to_insert = {"@id":uniq_id, "app_object": app_id, "timestamp": current_timestamp, "facebook_profile": profile}
        self.insert_object_to_indx(object_to_insert)
        logging.info("Facebook Service - Found Facebook Profile information, Added To INDX {0} profile items".format(len(profile)))

    ##here are all the facebook methods to havest the data
    def harvest_facebook_statuses(self):
        logging.debug('Facebook Service - Getting users Facebook Statuses')
        graph = facebook.GraphAPI(self.facebook_access_token_long)
        statuses = graph.get_connections("me", "statuses")
        statuses = statuses['data']
        current_timestamp = str(datetime.datetime.now())
        uniq_id = "facebook_statuses_at_"+current_timestamp
        object_to_insert = {"@id":uniq_id, "app_object": app_id, "timestamp": current_timestamp, "facebook_statuses": statuses}
        self.insert_object_to_indx(object_to_insert)
        logging.info("Facebook Service - Found Statuses, Added To INDX {0} statuses".format(len(statuses)))
        #for status in statuses['data']:
            #print status

    def harvest_facebook_friends(self):
        logging.debug('Facebook Service - Getting users Facebook Statuses')
        graph = facebook.GraphAPI(self.facebook_access_token_long)
        #profile = graph.get_object("me")
        #rint profile
        friends = graph.get_connections("me", "friends")
        friends = friends['data']
        #print friends
        #friend_list = [friend['id'] for friend in friends['data']]
        current_timestamp = str(datetime.datetime.now())
        uniq_id = "facebook_friends_list_at_"+current_timestamp
        object_to_insert = {"@id":uniq_id, "app_object": app_id, "timestamp":current_timestamp, "facebook_friends_list": friends}
        self.insert_object_to_indx(object_to_insert)
        logging.info("Facebook Service - Found Friends List, Added To INDX {0} Friends".format(len(friends)))
        #for f in friend_list:
            #print f

    def insert_object_to_indx(self, obj):
     
        try:
            if len(obj)>0:
                response = self.indx_con.update(self.version, obj)
                logging.debug("Inserted Object into INDX: ".format(response))
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    self.version = json_response['@version']
                    logging.debug('INDX insert error in Twitter Service Object: '+str(response))
                    try:
                        response = self.indx_con.update(self.version, obj)
                        logging.debug('Facebook Service - Successfully added Objects into Box')
                    except:
                        logging.error('Facebook Service, error on insert {0}'.format(response))
                else:
                    logging.error('Facebook Service Unknow error: {0}'.format(e.read()))
            else:
                logging.error("Error updating INDX: {0}".format(e))

