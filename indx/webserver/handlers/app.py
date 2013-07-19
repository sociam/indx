#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
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

from twisted.web.resource import Resource
from twisted.web.static import File
from twisted.web.resource import NoResource

import apps

# map apps/modulename/x -> handler
# map apps/modulename/html/x  -> static

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

    def _register_apps(self, server):
        logging.debug(' apps dir {0}'.format(repr(dir(apps))))
        for appname, vals in apps.MODULES.iteritems():
            logging.debug("registering app {0}".format(appname))
            module,html = vals['module'],vals['html']
            # logging.debug(' module dir {0}'.format(repr(dir(module))))
            if getattr(module, 'APP', None):
                ## instantiate the app
                self.apps[appname] = module.APP(server)
                if html:
                    logging.debug('putting html static {0} '.format(html))
                    self.apps[appname].putChild('html', File(html))
                    pass
                pass
            
    def _register_apps_debug(self, server):
        for appname, vals in apps.MODULES.iteritems():
            logging.debug("registering app {0}".format(appname))
            module,html = vals['module'],vals['html']
            logging.debug(' module dir {0}'.format(html))
            if not html: 
                # TODO: handle this case
                continue            
            file_handler = File(html)                        
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
                

    def get_apps(self):
        return dict([(k,v['module']) for k,v in apps.MODULES.iteritems()])            
    
    def options(self, request):
        self.return_ok(request)

    def render(self, request):
        ## nothing necessary here
        logging.debug('render request for apps ')
        return self.render(request)
