#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith, Max Van Kleek
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

import logging, traceback, json
from twisted.web.resource import Resource
from webbox.webserver.handlers.base import BaseHandler
import webbox.webbox_pg2 as database
from webbox.objectstore_async import ObjectStoreAsync

class EnrichHandler(BaseHandler):
    """ Add/remove boxes, add/remove users, change config. """
    base_path = 'enrich'

    def get_establishments(self, request):
        desc = request.args['description'][0]
        self.return_ok(request, {"entries": [{"text": desc, "weight": 100}, {"text": desc.lower(), "weight": 50}]})
        
EnrichHandler.subhandlers = [
    {
        'prefix': 'get_establishments',
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': EnrichHandler.get_establishments,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
    }
]
