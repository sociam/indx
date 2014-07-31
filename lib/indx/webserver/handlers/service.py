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

import logging, json, tempfile, subprocess, sys
import traceback
from indx.reactor import IndxRequest
from twisted.web.server import NOT_DONE_YET
from indx.webserver.handlers.base import BaseHandler

class ServiceHandler(BaseHandler):

    def __init__(self, server, service_path):
        BaseHandler.__init__(self, server, register=False)
        self.indx_reactor = server.indx_reactor
        self.server = server

        self.base_path = "apps"

        self.pipe = None
        self.service_path = service_path
        self.subhandlers = self._make_subhandlers()
        self._set_up_output_buffers()

    def _set_up_output_buffers(self):
        self.errpipe_out = tempfile.NamedTemporaryFile()
        self.errpipe_in = open(self.errpipe_out.name,'r')
        self.err_output = []
        self.stdoutpipe_out = tempfile.NamedTemporaryFile()
        self.stdoutpipe_in = open(self.stdoutpipe_out.name,'r')
        self.std_output = []


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
            },
            {
                "prefix": "{0}/api/get_stderr".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.get_stderr_log,
                'accept':['application/json'],
                'content-type':'application/json'
            },
            {
                "prefix": "{0}/api/get_stdout".format(self.service_path),
                'methods': ['GET'],
                'require_auth': True,
                'require_token': False,
                'handler': ServiceHandler.get_stdout_log,
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

    def get_config(self, request, token):
        try:
            #print "in service.py - get config"
            manifest = self._load_manifest()
            # logging.debug(' manfest {0} '.format(manifest['get_config']))
            result = subprocess.check_output(manifest['get_config'],cwd=self.get_app_cwd())
            # logging.debug(' get config {0}'.format(result))
            #print "service.py - getConfig Manifest returned: "+str(result)
            #logging.debug(' get config result {0} {1}'.format(result))
            result = json.loads(result)
            #print "service.py - getConfig json: "+str(result)
            # logging.debug(' get json config result {0} '.format(result))
            return self.return_ok(request,data={'config':result})
        except :
            print "error in service.py get config"+str(sys.exc_info())
            logging.error("Error in get_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)

    def get_app_cwd(self):
        cwd = "apps/{0}".format(self.service_path)
        # logging.debug('getappcwd {0}'.format(cwd))
        return cwd
        
    def set_config(self, request, token): 
        try:
            #print "in service.py - set config"
            # invoke external process to set their configs
            # logging.debug("set_config -- getting config from request")        
            jsonconfig = self.get_arg(request, "config")
            # logging.debug("set_config config arg {0}".format(jsonconfig))
            ## load the manifest 
            manifest = self._load_manifest()
            # logging.debug("set_config jsonconfig arg {0}".format(jsonconfig))

            # somewhere inside this we have put {0} wildcard so we wanna substitute that
            # with the actual config obj
            expanded = [x.format(jsonconfig) for x in manifest['set_config']]
            result = subprocess.call(expanded, cwd=self.get_app_cwd())
            # logging.debug("result of subprocess call {0}".format(result))
            return self.return_ok(request, data={'result': result})
        except :
            logging.error("Error in set_config {0}".format(sys.exc_info()[0]))
            return self.return_internal_error(request)

    def is_running(self):
        if self.pipe is not None:
            logging.debug(" pipe poll {0}".format(self.pipe.poll()))
        return self.pipe is not None and self.pipe.poll() is None

    def start(self):
        print "service.py - Start called"
        if self.is_running(): self.stop()
        manifest = self._load_manifest()
        command = [x.format(self.webserver.server_url) for x in manifest['run']]
        print command
        self._set_up_output_buffers()
        self.pipe = subprocess.Popen(command,cwd=self.get_app_cwd())#,stderr=self.errpipe_out,stdout=self.stdoutpipe_out)
        return self.is_running()

    def _dequeue_stderr(self):
        if (self.errpipe_out.tell() == self.errpipe_in.tell()): return
        new_lines = self.errpipe_in.read()
        if new_lines: self.err_output.extend([x.strip() for x in new_lines.split('\n') if len(x.strip()) > 0])
    def _dequeue_stdout(self):
        if (self.stdoutpipe_out.tell() == self.stdoutpipe_in.tell()): return
        new_lines = self.stdoutpipe_in.read()
        if new_lines: self.std_output.extend([x.strip() for x in new_lines.split('\n') if len(x.strip()) > 0])

    def get_stderr_log(self,request, token):
        self._dequeue_stderr()
        from_id = self.get_arg(request, "offset") and int(self.get_arg(request,"offset"))
        if not from_id: from_id = 0
        return self.return_ok(request,data={'messages':self.err_output[from_id:]})
    def get_stdout_log(self,request, token):
        self._dequeue_stdout()
        from_id = self.get_arg(request, "offset") and int(self.get_arg(request,"offset"))
        if not from_id: from_id = 0
        return self.return_ok(request,data={'messages':self.std_output[from_id:]})

    def start_handler(self,request, token):
        result = self.start()
        return self.return_ok(request, data={'result': result})

    def stop(self):
        if self.is_running():
            self.pipe.kill()
        self.pipe = None

    def stop_handler(self,request, token):
        self.stop()
        return self.return_ok(request)

    def is_running_handler(self,request, token):
        return self.return_ok(request, data={'running': self.is_running()})

    def render(self, request):
        logging.debug("SERVICE HANDLER RENDER :::::::::::::::::::::::::: ")
#        return BaseHandler.render(self,request)


        uri = request.uri
        method = request.method
        path = request.path
        params = {
            "headers": request.headers,
            "args": request.args,
        }

        logging.debug("IndxServiceHandker, request, path: {0}".format(path))

        def callback(indx_response):
            logging.debug("IndxServiceHandler, request callback")

            try:
                response = {"message": indx_response.message, "code": indx_response.code}
                response.update(indx_response.data)
                responsejson = json.dumps(response)

                if not request._disconnected:
                    request.setResponseCode(indx_response.code, indx_response.message)
                    request.setHeader("Content-Type", "application/json")
                    request.setHeader("Content-Length", len(responsejson))

                    for key, value in indx_response.headers.items():
                        request.setHeader(key, value)

                    request.write(responsejson)
                    request.finish()
                    logging.debug(' just called request.finish() with code %d ' % indx_response.code)
                else:
                    logging.debug(' didnt call request.finish(), because it was already disconnected')
            except Exception as e:
                logging.debug("IndxServiceHandler error sending response: {0},\ntrace: {1}".format(e, traceback.format_exc()))

        indx_request = IndxRequest(uri, method, self.base_path, path, params, request.content, request.getSession().uid, callback, request.getClientIP(), self.server.server_id)
        self.indx_reactor.incoming(indx_request)
        return NOT_DONE_YET






