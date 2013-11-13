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

import logging, os

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
        self.apps = {}
        self.index = File('html/index.html')
        self._register_apps_debug(webserver)

    def getChild(self, path, request):
        logging.debug('get child ' + path ) # type(path) + " " + repr(request))
        return self.apps.get(path) or NoResource()

    def getAppsandServices(self):
        ## returns any subdirectoires of /apps that have a manifest.json
        return [d for d in os.listdir('apps') if os.path.exists(os.path.join('apps', d,'manifest.json'))]

    def _register_apps_debug(self, server):

        ## legacy apps (that have __init__.py) 
        for appname, vals in apps.MODULES.iteritems():
            logging.debug("registering app {0}".format(appname))
            module,html = vals['module'],vals['html']
            logging.debug(' module dir vals {0}'.format(vals))
            if not html: 
                file_handler = NoHTMLHandler()
            else:
                file_handler = File(html)                        

            # step 0: read the manifest file in the directory
            # if this is a service, then... we should instantiate a ServiceHandler 
            # for it passing it its base path (that is appname)
            # 

            if getattr(module, 'APP', None):
                app = module.APP(server)
                self.apps[appname] = app
                logging.debug('registering api child {0}'.format(repr(app)))
                file_handler.putChild('api', app)
            else:
                logging.debug('static content only {0}'.format(html))
                pass
                # file_handler.putChild(appname,File(html))
            self.putChild(appname,file_handler) ## this puts things at the base -- rather than putting the app handler
        ## end of support for legacy apps

        ## now for new apps!
        legacy_apps = apps.MODULES.keys()
        new_apps = set(self.getAppsandServices()) - set(legacy_apps)
        for appbase in new_apps:
            ## do cooooooooooool stuff.
            logging.debug("Instantiating handler for New Style App : {0}".format(appbase))
            # first add html directory
            if os.path.exists(os.path.join('apps', appbase, 'html')):
                file_handler = File(os.path.join('apps', appbase, 'html'))
            else:
                file_handler = NoHTMLHandler()
            # try to see if it's a service
            handler = ServiceHandler(server, appbase)                
            if handler.is_service() :
                file_handler.putChild('api', handler)                
            file_handler.putChild('manifest', File(os.path.join('apps', appbase, 'manifest.json')))

    def get_apps(self):
        return dict([(k,v['module']) for k,v in apps.MODULES.iteritems()])            
    
    def options(self, request):
        self.return_ok(request)

    def render(self, request):
        ## nothing necessary here
        logging.debug('render request for apps ')
        return self.render(request)
