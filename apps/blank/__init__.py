import logging, json
from indx.webserver.handlers.base import BaseHandler
import requests
from indxclient import IndxClient
from blank import BlankApp

class BlankApp(BaseHandler):

    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = True
        self.app = BlankApp() # with any params a real app would need

    def config(self): # what params?
    	if "first use":
    		# how do we check that it's first use?
    	else :
    		# when we want to change somthing in the config

    def check_auth(self):
    	# check if the app can do stuff 
    	return False

    def start(self):
    	if check_auth():
    		# do the stuff
    	else:
    		# error because the app is not authorised

    def stop(self):
    	if check_auth():
    		# stop me!
    	else:
    		# can't stop me!

APP = BlankApp
