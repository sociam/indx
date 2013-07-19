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

import logging, traceback, json, re
from twisted.web.resource import Resource
from indx.webserver.handlers.base import BaseHandler
from indx.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred

class TestApp(BaseHandler):
    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = False

    def hello(self, request):
        self.return_ok(request, { data: "hello" })

TestApp.submodules = [
   # TODO: dispatching with apps doesn't seem to work yet
   #  { 
   #      'prefix':'hello',
   #      'methods': ['GET'],
   #      'require_auth': False,
   #      'require_token': False,
   #      'handler': BaseHandler.return_ok,
   #      'content-type':'text/plain', # optional
   #      'accept':['application/json']
   # }
]

APP = TestApp
