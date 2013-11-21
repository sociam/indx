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
#from indxclient import IndxClient



FACEBOOK_APP_ID = "415327441930292"
FACEBOOK_APP_SECRET = "f8a18987d9c8641b9797df94d916b653"

user_token = "CAACEdEose0cBAMcqUvpsZCb4tqByxcL7lUceoXjArKieThZAUaIFEtNTa7dcErlZBiBYjboZCG3oHyT5yZAQdZAiIwc2Mk2a29tWyUAW7vL6ZBpRGP30uZAdZArnXnyvxnAIMsQNs3lZAmPewL7h368bHuFt3T55hlvoxmQMZBAqEEz0yvJlOAPGrdPQJcTvHePMoaEi6t6PYIaVgZDZD"
#user_token = "CAAGRfoP2rgIBAAjSVaznIsZCxubV8KzTYZBrhRaDhA9pGA8hK2kOjRtgQlTUZANl0n0uJFtk3ZBDO1mBZCfOE06ku3P1NRr8NrN30xsHUgZBCwJJgCMoEoW2J7w7l85C6ZBC89ggaLxkaZAUdSaK8nYKT8ZBZAsSHayzGAPQS1kSPZALMVGf201oaTPf13VMGm32EIY4egRXy7wDAZDZD"
app_token = "441447542599170|8B8irGqMVlyLl1Bke4Nm9Y6pquo"


class FacebookService:

	def __init__(self, config):
	 	print "Facebook Service - Getting configs from Facebook Controller"
	 	self.facebook_access_token_long = config['facebook_access_token_long']
	 	self.facebook_userid = config['facebook_userid']
	 	self.facebook_access_token_expire_time = config['facebook_access_token_expire_time']
	 	self.config_timestamp = config['config_timestamp']
	 	#in reality this is all we need from facebook, but we want to also check that the current date is not over 60 days...
	 	print "Facebook Service - Checking if token is not expired"
	 	self.token_active = False
	 	if self.check_if_token_not_expired():
	 		self.token_active = True

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
	def harvest_facebook_statuses(self):
		graph = facebook.GraphAPI(self.facebook_access_token_long)
		#profile = graph.get_object("me")
		#rint profile
		statuses = graph.get_connections("me", "statuses/")
		#print friends
		#friend_list = [friend['id'] for friend in friends['data']]
		for status in statuses['data']:
			print status

	def harvest_facebook_friends(self):
		graph = facebook.GraphAPI(self.facebook_access_token_long)
		#profile = graph.get_object("me")
		#rint profile
		friends = graph.get_connections("me", "friends")
		friend_list = [friend['id'] for friend in friends['data']]
		for f in friend_list:
			print f

# args = dict(client_id=FACEBOOK_APP_ID, redirect_uri=self.request.path_url)
# redirect = "https://graph.facebook.com/oauth/authorize?" + urllib.urlencode(args)
# print redirect


# class User(db.Model):
#     """User Model Class"""
#     id = db.StringProperty(required=True) #facebook user-id
#     created = db.DateTimeProperty(auto_now_add=True)
#     updated = db.DateTimeProperty(auto_now=True)
#     name = db.StringProperty(required=True)
#     profile_url = db.StringProperty(required=True)
#     access_token = db.StringProperty(required=True)  #fb OAUTH access token

