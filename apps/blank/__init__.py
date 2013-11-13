
import logging, json, subprocess,sys

from indx.webserver.handlers.base import BaseHandler
from indxclient import IndxClient

class BlankApp(BaseHandler):

    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = True
        self.pipe = None


    def _get_indx_creds(self):
        pass

    def _load_manifest(self):
        manifest_data = open('apps/blank/manifest.json')
        manifest = json.load(manifest_data)
        manifest_data.close()
        return manifest

    def get_config(self,request):
        try:
            manifest = self._load_manifest()
            result = subprocess.check_output(manifest['get_config'])
            logging.debug(' get config result {0} '.format(result))
            result = json.loads(result)
            logging.debug(' take 2 >> get config result {0} '.format(result))
            return self.return_ok(request,data={'config':result})
        except :
            logging.error("Error in set_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)
        
    def set_config(self, request): # what params?
        try:
            # when we want to change something in the config
            # invoke external process to set their configs
            logging.debug("set_config -- getting config from request")        
            # config = json.loads(self.get_arg(request, "config"))
            config = self.get_arg(request, "config")
            logging.debug("blank config {0}".format(config))
            # get the config we want to set out of request
            ## load the manifest 
            manifest = self._load_manifest()
            jsonconfig = json.dumps(config)
            # somewhere inside this we have put {0} wildcard so we wanna substitute that
            # with the actual config obj
            expanded = [x.format(jsonconfig) for x in manifest['set_config']]
            result = subprocess.call(expanded)
            logging.debug("result of subprocess call {0}".format(result))
            return self.return_ok(request, data={'result': result})
        except :
            logging.error("Error in set_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)

    def isRunning(self):
        if self.pipe is not None:
            logging.debug(" pipe poll {0}".format(self.pipe.poll()))
        return self.pipe is not None and self.pipe.poll() is None

    def start(self):
        if self.isRunning():
           self.stop()
        # do the stuff
        manifest = self._load_manifest()
        command = manifest['run']
        self.pipe = subprocess.Popen(command)
        return self.isRunning()

    def start_handler(self,request):
        result = self.start()
        return self.return_ok(request, data={'result': result})

    def stop(self):
        if self.isRunning():
            self.pipe.kill()
        self.pipe = None

    def stop_handler(self,request):
        self.stop()
        return self.return_ok(request)

    def is_running_handler(self,request):
        return self.return_ok(request, data={'running': self.isRunning()})

BlankApp.subhandlers = [
    {
        "prefix": "blank/api/set_config",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.set_config,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/get_config",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.get_config,
        'accept':['application/json'],
        'content-type':'application/json'
    },    
    {
        "prefix": "blank/api/start",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.start_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/stop",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.stop_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/is_running",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.is_running_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    }

]


APP = BlankApp
