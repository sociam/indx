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

import argparse, ast, logging, getpass, sys, urllib, urllib2, json, sys, datetime, time, threading
from datetime import datetime
from threading import Timer, Thread
from service_facebook import FacebookService
from twisted.internet import task
from twisted.internet.defer import Deferred
from twisted.internet import reactor, threads
    
logging.basicConfig(level=logging.INFO)


FACEBOOK_APP_ID = "415327441930292"
FACEBOOK_APP_SECRET = "f8a18987d9c8641b9797df94d916b653"


class FacebookServiceController:

    def __init__(self, config):
        #First get the parameters ready for the Harvester
        self.load_parameters(config)


    #load and managed parameters
    def load_parameters(self, config):
        try:
            logging.debug("Facebook Service - loading Credentials....")
            #config = config.replace("\"","'")
            #config = ast.literal_eval(config)
            #for k,v in config.iteritems():
                #print k,vs
            #first set of parameters might only be the Facebook Access Key and token...
            token_type = config['facebook_auth_status']
            if "Short" in token_type:
                #we need to get a long life token...
                logging.debug("Service Controller Facebook - Received short Token")
                logging.debug("Trying to Get Long TOKEN")
                grant_type= "fb_exchange_token"
                fb_exchange_token = config['facebook_access_token']
                self.get_long_token(grant_type,FACEBOOK_APP_ID,FACEBOOK_APP_SECRET,fb_exchange_token)
            elif "Long" in token_type:
                logging.debug("Service Controller Facebook - Received full token")
                self.config = config
        except:
            pass

    def get_long_token(self, grant_type,FACEBOOK_APP_ID,FACEBOOK_APP_SECRET,fb_exchange_token):
        """ Get a API token using a user's credentials and store it in this object. """
        try:
            url = "https://graph.facebook.com/oauth/access_token?"

            """ Make the HTTP request. """
            body = urllib.urlencode({"grant_type": grant_type, "client_id": FACEBOOK_APP_ID, "client_secret": FACEBOOK_APP_SECRET, "fb_exchange_token": fb_exchange_token })
            req = urllib2.Request(url, body)
            response = urllib2.urlopen(req)
            fb_response = response.read()
            #store the access token
            self.facebook_access_token_long = fb_response.split("&expires=")[0].replace("access_token=","")
            self.facebook_access_token_expire_time = fb_response.split("&expires=")[1]
            #print self.access_token_long
            #print self.expire_time
        except:
            logging.debug("Facebook Service Controller - Couldn not get long token due to {0}".format(sys.exc_info()))

    def getAccesstokenConfig(self):
        config = {"facebook_access_token_long": self.facebook_access_token_long, "facebook_access_token_expire_time": self.facebook_access_token_expire_time}
        config = json.dumps(config)
        return config

    def load_service_instance(self):

        try:
            facebook_service = FacebookService(self.config)

            def indx_cb(empty):

                def harvest_all_cb(re):
                    logging.info("harvested all Facebook data sources, now attempting to wait for an hour")
                    reactor.callLater(3600.0, self.load_service_instance)

                facebook_service.harvest_all().addCallbacks(harvest_all_cb, lambda failure: logging.error("Facebook Service Controller - Callback Failure: Harvest All"))

            facebook_service.get_indx().addCallbacks(indx_cb, lambda failure: logging.error("Facebook Service Controller error logging into INDX: {0}".format(failure)))
            reactor.run() #@UndefinedVariable
        except:
            logging.info("An error occured in FacebookServiceController: load_service_instance")
            print sys.exc_info()

    def start_reactor(self):
        reactor.run()





    
