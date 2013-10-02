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

import os, logging, json
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

    def docs(self, request):
        """ Get a list of tests.
        """
        logging.debug('getting tests')
        currdir = os.path.dirname(os.path.abspath(__file__))
        tdir = os.path.sep.join([currdir, '..', '..', 'lib', 'indx', 'docs'])
        files = [o for o in os.listdir(tdir)]
        logging.debug("docs configs: {0}".format(files))

        self.return_ok(request, data = {"response": files})


DevToolsApp.subhandlers = [
    {
        "prefix": "devtools/api/tests",
        'methods': ['GET', 'PUT'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.tests,
        'accept':['*'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/docs",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.docs,
        'accept':['*/*'],
        'content-type':'application/json'
        }
]


APP = DevToolsApp