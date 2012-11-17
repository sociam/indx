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
    
    def get_next_round(self, request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store

        desc = request.args['user'][0]
        
        round = []
        
        self.return_ok(request, {"round": round})

    def get_establishments(self, request):
        desc = request.args['q'][0]
        self.return_ok(request, {"entries": [{"text": desc, "weight": 100}, {"text": desc.lower(), "weight": 50}]})

    def get_places(self, request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store
        
        # the highlighted string from user: "Kings X"
        q = request.args['q'][0]
        
        # query db for something similar to q
        d = []
        
        d.append({"id": desc, "name": desc.lower()})
        
        self.return_ok(request, {"entries": d})
        
        
EnrichHandler.subhandlers = [
    {
        'prefix': 'get_establishments',
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': EnrichHandler.get_establishments,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
    },
    {
        'prefix': 'get_places',
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': EnrichHandler.get_places,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
    },
    {
        'prefix': 'get_next_round',
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': EnrichHandler.get_next_round,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
    }
]
