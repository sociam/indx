#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
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

import logging
import json
import subprocess
import sys
from indx.webserver.handlers.base import BaseHandler

class ServiceHandler(BaseHandler):

    def __init__(self, server, service_path):
        BaseHandler.__init__(self, server, register=False)
        self.pipe = None
        self.service_path = service_path
        self.subhandlers = self._make_subhandlers()

    def is_service(self):
        manifest = self._load_manifest()
        return 'type' in manifest and 'service' in manifest['type']

    def on_boot(self):
        manifest = self._load_manifest()
        return 'on_boot' in manifest and manifest['on_boot']

    def _make_subhandlers(self):
        return [
            {
                "prefix": "{0}/api/set_config".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.set_config,
                'accept':['application/json'],
                'content-type':'application/json'
            },
            {
                "prefix": "{0}/api/get_config".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.get_config,
                'accept':['application/json'],
                'content-type':'application/json'
            },    
            {
                "prefix": "{0}/api/start".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.start_handler,
                'accept':['application/json'],
                'content-type':'application/json'
            },
            {
                "prefix": "{0}/api/stop".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.stop_handler,
                'accept':['application/json'],
                'content-type':'application/json'
            },
            {
                "prefix": "{0}/api/is_running".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.is_running_handler,
                'accept':['application/json'],
                'content-type':'application/json'
            }
        ]

    def _load_manifest(self):
            # throw error!
        if self.service_path is None:
            logging.error("Error in _load_manifest: Cannot find manifest - no service path set!") 
            return self.return_internal_error("No service path set. Cannot find manifest")
        manifest_path = "apps/{0}/manifest.json".format(self.service_path)
        manifest_data = open(manifest_path)
        manifest = json.load(manifest_data)
        manifest_data.close()
        return manifest

    def get_config(self, request):
        try:
            #print "in service.py - get config"
            manifest = self._load_manifest()
            result = subprocess.check_output(manifest['get_config'],cwd=self.get_app_cwd())
            #print "service.py - getConfig Manifest returned: "+str(result)
            logging.debug(' get config result {0} '.format(result))
            #result = json.loads(result)
            logging.debug(' get json config result {0} '.format(result))
            return self.return_ok(request,data={'config':result})
        except :
            print "error in service.py get config"+str(sys.exc_info())
            logging.error("Error in get_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)

    def get_app_cwd(self):
        cwd = "apps/{0}".format(self.service_path)
        logging.debug('getappcwd {0}'.format(cwd))
        return cwd
        
    def set_config(self, request): 
        try:
            #print "in service.py - set config"
            # invoke external process to set their configs
            logging.debug("set_config -- getting config from request")        
            config = self.get_arg(request, "config")
            logging.debug("set_config config arg {0}".format(config))
            ## load the manifest 
            manifest = self._load_manifest()
            jsonconfig = json.dumps(config)
            # somewhere inside this we have put {0} wildcard so we wanna substitute that
            # with the actual config obj
            expanded = [x.format(jsonconfig) for x in manifest['set_config']]
            result = subprocess.call(expanded, cwd=self.get_app_cwd())
            logging.debug("result of subprocess call {0}".format(result))
            return self.return_ok(request, data={'result': result})
        except :
            logging.error("Error in set_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)

    def is_running(self):
        if self.pipe is not None:
            logging.debug(" pipe poll {0}".format(self.pipe.poll()))
        return self.pipe is not None and self.pipe.poll() is None

    def start(self):
        if self.is_running():
           self.stop()
        manifest = self._load_manifest()
        command = [x.format(self.webserver.server_url) for x in manifest['run']]
        self.pipe = subprocess.Popen(command,cwd=self.get_app_cwd())
        return self.is_running()

    def start_handler(self,request):
        result = self.start()
        return self.return_ok(request, data={'result': result})

    def stop(self):
        if self.is_running():
            self.pipe.kill()
        self.pipe = None

    def stop_handler(self,request):
        self.stop()
        return self.return_ok(request)

    def is_running_handler(self,request):
        return self.return_ok(request, data={'running': self.is_running()})

    def render(self, request):
        logging.debug("SERVICE HANDLER RENDER :::::::::::::::::::::::::: ")
        return BaseHandler.render(self,request)

