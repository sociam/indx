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
#from facebook import GraphAPI
from datetime import datetime
from threading import Timer
#from indxclient import IndxClient



FACEBOOK_APP_ID = "415327441930292"
FACEBOOK_APP_SECRET = "f8a18987d9c8641b9797df94d916b653"

user_token = "CAACEdEose0cBAMcqUvpsZCb4tqByxcL7lUceoXjArKieThZAUaIFEtNTa7dcErlZBiBYjboZCG3oHyT5yZAQdZAiIwc2Mk2a29tWyUAW7vL6ZBpRGP30uZAdZArnXnyvxnAIMsQNs3lZAmPewL7h368bHuFt3T55hlvoxmQMZBAqEEz0yvJlOAPGrdPQJcTvHePMoaEi6t6PYIaVgZDZD"
#user_token = "CAAGRfoP2rgIBAAjSVaznIsZCxubV8KzTYZBrhRaDhA9pGA8hK2kOjRtgQlTUZANl0n0uJFtk3ZBDO1mBZCfOE06ku3P1NRr8NrN30xsHUgZBCwJJgCMoEoW2J7w7l85C6ZBC89ggaLxkaZAUdSaK8nYKT8ZBZAsSHayzGAPQS1kSPZALMVGf201oaTPf13VMGm32EIY4egRXy7wDAZDZD"
app_token = "441447542599170|8B8irGqMVlyLl1Bke4Nm9Y6pquo"


class FacebookService:

	 def __init__(self):
	 	print "do something"
        

# graph = facebook.GraphAPI(user_token)
# #profile = graph.get_object("me")
# #rint profile
# statuses = graph.get_connections("me", "statuses/")
# #print friends
# #friend_list = [friend['id'] for friend in friends['data']]

# for status in statuses['data']:
# 	print status

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

