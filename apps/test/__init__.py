#    This file is part of WebBox.
#
#    Copyright 2011-2012 Max Van Kleek
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging, traceback, json, re
from twisted.web.resource import Resource
from webbox.webserver.handlers.base import BaseHandler
from webbox.objectstore_async import ObjectStoreAsync
from twisted.internet.defer import Deferred

class TestApp(BaseHandler):
    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = False

    def hello(self, request):
        self.return_ok(request, { data: "hello" })

TestApp.submodules = [
    { 
        'prefix':'hello',
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': BaseHandler.return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']
   }
]

APP = TestApp
