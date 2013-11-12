
import logging, json, subprocess

from indx.webserver.handlers.base import BaseHandler
from indxclient import IndxClient

class BlankApp(BaseHandler):

    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = True
        manifest_data = open('manifest.json')
        self.manifest = json.load(manifest_data)
        manifest_data.close()

    def _get_indx_creds(self):
        pass
        
    def set_config(self, request): # what params?
        # when we want to change something in the config
        # invoke external process to set their configs
        
        # get theconfiguraiton we want to set out of request
        # do that thang here
        config = {}
        jsonconfig = json.dumps(config)
        # somewhere inside this we have put {0} wildcard so we wanna substitute that
        # with the actual config obj
        expanded = [x.format(jsonconfig) for x in self.manfiest['config']]
        subprocess.call(expanded)


    def _check_auth(self):
        # check if the app can do stuff 
        return False

    def start(self):
        if check_auth():
            # do the stuff
            pass
        else:
            # error because the app is not authorised
            pass
        pass

    def stop(self):
        if check_auth():
            # stop me!
            pass
        else:
            # can't stop me!
            pass
        pass


APP = BlankApp
