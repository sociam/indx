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

import logging, os, json
from functools import partial
from operator import is_not

from twisted.web.resource import Resource
from twisted.web.static import File
from twisted.web.resource import NoResource

import apps
from indx.webserver.handlers.service import ServiceHandler

# map apps/modulename/api/x -> handler
# map apps/modulename/x  -> static

class NoHTMLHandler(Resource):
    def render(self, request):
        return "Nothing to see here."

class AppsMetaHandler(Resource):

    def __init__(self,webserver):
        Resource.__init__(self)
        self.isLeaf = False
        self.index = File('html/index.html')
        self._register_apps(webserver)

    # def getChild(self, path, request):
    #     # i don't think this actually happens.
    #     logging.debug('get child ' + path ) # type(path) + " " + repr(request))
    #     return self.apps.get(path) or NoResource()

    def getNewModuleNames(self):
        ## returns any subdirs of /apps that have a manifest.json
        return [d for d in os.listdir('apps') if os.path.exists(os.path.join('apps', d,'manifest.json'))]

    def _register_apps(self, server):
        ## legacy apps (that have __init__.py) 
        for appname, vals in apps.MODULES.iteritems():
            module,html = vals['module'],vals['html']
            logging.debug("Legacy App Registering {0} --- module: {1};  html: {2}".format(appname, module, html))
            if not html: 
                file_handler = NoHTMLHandler()
            else:
                logging.debug('HTML handler {0}'.format(html))
                file_handler = File(html)                        
            if getattr(module, 'APP', None):
                app = module.APP(server)
                logging.debug('registering api child {0}'.format(repr(app)))
                file_handler.putChild('api', app)
            else:
                logging.debug('static content only {0}'.format(html))
                pass
                # file_handler.putChild(appname,File(html))
            logging.debug("legacy putchild {0}, handler: {1} ".format(appname,file_handler))
            self.putChild(appname,file_handler) ## this puts things at the base -- rather than putting the app handler
        ## end of support for legacy apps

        ## now for new apps!
        legacy_apps = apps.MODULES.keys()
        new_apps = set(self.getNewModuleNames()) - set(legacy_apps)
        basedir = apps.BASEDIR

        for appbase in new_apps:
            logging.debug("Instantiating handler for New Style App : {0}".format(appbase))
            # first add html directory
            if os.path.exists(os.path.join(basedir, appbase, 'html')):
                # logging.debug("Adding html static dir {0}".format(os.path.join(basedir, appbase, 'html')))
                file_handler = File(os.path.join(basedir,  appbase, 'html'))
            else:
                file_handler = NoHTMLHandler()
            # # try to see if it's a service
            handler = ServiceHandler(server, appbase)
            if handler.is_service() :
                # logging.debug(" This is a service, so registering an api child >>>>>>>>>>>>>>>>>>>>>>>> ");
                ## putting child under api
                file_handler.putChild('api', handler) 
                if handler.on_boot() :
                    handler.start()
            else:
                logging.debug("{0} Not a service, so not registering an app".format(appbase))
                pass
            file_handler.putChild('.manifest', File(os.path.join(basedir, appbase, 'manifest.json')))
            self.putChild(appbase,file_handler) ## this puts things at the base -- rather than putting the app handler
        pass


    def get_manifest(self, modulename):
        try:
            manifest_path = os.path.join(apps.BASEDIR, modulename, 'manifest.json')
            manifest_data = open(manifest_path,'r')
            manifest = json.load(manifest_data)
            manifest_data.close()
            return manifest
        except Exception as e:
            logging.error("Unable to load module {0}, skipping.".format(modulename))
            return None

    def get_modules(self):
        ## apps and services are modules
        all = set(apps.MODULES.keys()).union(self.getNewModuleNames())
        def kv(k):
            kv = self.get_manifest(k)
            if kv is None:
                return None
            kv["@id"] = k
            return kv
        return filter(partial(is_not, None), [kv(k) for k in all])
    
    def options(self, request):
        self.return_ok(request)

    def render(self, request):
        ## nothing necessary here
        logging.debug('render request for apps ')
        return self.render(request)
