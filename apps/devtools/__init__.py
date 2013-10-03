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

import os, logging, json, re
from indx.webserver.handlers.base import BaseHandler
from twisted.web.server import NOT_DONE_YET
import requests
from subprocess import check_output



class DevToolsApp(BaseHandler):


    def __init__(self, server):
        BaseHandler.__init__(self, server)
        logging.debug(' hello')
        self.isLeaf = True

    def tests(self, request):
        """ Get a list of tests.
        """
        if request.method == 'GET':
            logging.debug('getting tests')
            currdir = os.path.dirname(os.path.abspath(__file__))
            tdir = os.path.sep.join([currdir, '..', '..', 'lib', 'indx', 'tests'])
            files = [o for o in os.listdir(tdir)]
            logging.debug("test configs: {0}".format(files))
            self.return_ok(request, data = { "response": files })
        if request.method == 'PUT':
            logging.debug('running test')
            out = check_output('karma start /home/peter/webbox/lib/indx/tests/docsgen.config.js', shell=True)
            self.return_ok(request, data = { "response": out })

    def config_data(self, filename, config_type):
        name = filename.split('/')[-1].split('.')[0]

        app_name_r = re.compile('apps/([^/]+)/docs-config.js')
        app_name = app_name_r.findall(filename)
        logging.debug("hmm... %s" % app_name)
        if app_name:
            name = app_name[0]

        docs_path = 'apps/devtools/html/docs/%s' % name

        logging.debug(os.path.exists(docs_path))

        return {
            'name': name,
            'config_filename': filename,
            'path': docs_path,
            'url': 'apps/devtools/docs/%s' % name,
            'built': os.path.exists(docs_path)
            }

    def lookup_config(self, name):
        docs = self.get_docs_list()
        matches = [doc for doc in docs if doc['name'] == name]
        if not matches:
            self.return_forbidden(request) # todo: more useful return
        return matches[0];


    def get_config_list(self, config_type):
        logging.debug('getting list of doc configs')
        currdir = os.path.dirname(os.path.abspath(__file__))
        # look in apps
        appdir = os.path.sep.join([currdir, '..', '..', 'apps'])
        dirs = [os.path.normpath(appdir + os.path.sep + d) for d in os.listdir(appdir)]
        dirs.append(os.path.normpath(os.path.sep.join([currdir, '..', '..', 'lib', config_type, 'config'])))
        config_files = []
        for d in dirs:
            if os.path.isdir(d):
                logging.debug('checking directory %s' % d)
                files = os.listdir(d)
                for f in files:
                    f = d + os.path.sep + f;
                    logging.debug('checking file %s' % f)
                    config_end = config_type + '-config.js'
                    if os.path.isfile(f) and f.endswith(config_end):
                        logging.debug('found file %s' % f)
                        config_files.append(f);
        docs = [self.config_data(f, config_type) for f in config_files]
        logging.debug("configs: {0}".format(docs))
        return docs;

    def list_docs(self, request):
        """ Get a list of doc configs.
        """
        configs = self.get_config_list('docs')
        self.return_ok(request, data = { "response": configs })

    def list_tests(self, request):
        """ Get a list of doc configs.
        """
        configs = self.get_config_list('tests')
        self.return_ok(request, data = { "response": configs })

    def generate_doc(self, request):
        """ Generate documentation from config file.
        """
        logging.debug('trying to generate docs')
        args = request.args
        logging.debug('args %s', args['name'])
        if not args['name']:
            self.return_forbidden(request)
            return
        config_name = args['name'][0]
        config = self.lookup_config(config_name)
        if not config:
            self.return_forbidden(request)
            return
        logging.debug('checking name %s' % config['name'])
        logging.debug('generating doc %s' % config['name'])
        logging.debug('node docsgen/build.js %s ' % config['config_filename']);
        out = check_output('node docsgen/build.js %s --output-directory=%s' % (config['config_filename'], config['docs_path']), shell=True)
        logging.debug(out);
        config['build_output'] = out;
        config['built'] = os.path.exists(config['docs_path']);
        self.return_ok(request, data = { "response": config })

    def run_test(self, request):
        return


DevToolsApp.base_path = "devtools/api"

DevToolsApp.subhandlers = [
    {
        "prefix": "devtools/api/docs/list_tests",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.list_tests,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/docs/run_test",
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.run_test,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/docs/list_docs",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.list_docs,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/docs/generate_doc",
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.generate_doc,
        'accept':['application/json'],
        'content-type':'application/json'
        }
]


APP = DevToolsApp