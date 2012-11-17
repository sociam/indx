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
import uuid

class EnrichHandler(BaseHandler):
    """ Add/remove boxes, add/remove users, change config. """
    base_path = 'enrich'
    
    def val(self, value):
        return {"@value": value}
    
    def get_next_round(self, request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store

        desc = request.args['user'][0]
        user = ''
        owner = ''
        
        round = {
            "@id":              str(uuid.uuid1()),
            "type":             "round",
            "user":             None,
            "statement":        desc,
            "isOwn":            bool(owner == user)
        }
        
        place = self.try_to_find_entity(desc, 'places')
        if place is not None:
            round['place-start'] = place['start']
            round['place-end'] = place['end']
            round['place-full'] = place['full']
            round['place-abbrv'] = place['abbrv']
            
        establishment = self.try_to_find_entity(desc, 'establishments')
        if establishment is not None:
            round['establishment-start'] = establishment['start']
            round['establishment-end'] = establishment['end']
            round['establishment-full'] = establishment['full']
            round['establishment-abbrv'] = establishment['abbrv']
        
        self.return_ok(request, {"round": round})
        

    def get_establishments(self, request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store
        
        # the highlighted string from user: "Kings X"
        q = request.args['q'][0]
        
        self.return_ok(request, {"entries": search_entities_for_term(q, "establishments")})


    def get_places(self, request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store
        
        # the highlighted string from user: "Kings X"
        q = request.args['q'][0]
        
        self.return_ok(request, {"entries": search_entities_for_term(q, "places")})
 
    def search_entity_for_term(self, term, table_name, approx=False):
        d = []
        entities = store.get_latest(table_name)
        for entity_id, entity_info in entities :
            if (entity_id != "@version" and entity_id != "@graph"):
                if approx:
                    if entity_info["abbrv"]["@value"].find(q, 0) > -1:
                        d.append({"id": entity_id, "name": entity_info["full"]["@value"]})
                else:
                    if entity_info["abbrv"]["@value"] == q:
                        d.append({"id": entity_id, "name": entity_info["full"]["@value"], "count": entity_info["count"]["@value"]})
        return d
        
    def try_to_find_entity(self, description, table_name):
        parts = description.split()
        
        candidates = []
        for sublist in self.iter_sublists(parts):
            abbrv = ' '.join(sublist)
            matches = self.search_entity_for_term(abbrv, table_name)
            if len(matches) > 0:
                for match in matches:
                    #if match not in candidates:
                    candidates.append({
                        'abbrv':    abbrv,
                        'start':    q.find(abbrv, 0),
                        'end':      q.find(abbrv, 0) + len(abbrv),
                        'full':     match['name'],
                        'count':    match['count']
                    })
        
        if len(candidates) > 0:
            return None
        else:
            candidates.sorted(candidates, self.sort_candidates)
            return candidates[0]
        
    def sort_candidates(self, a, b):
        if a['count'] == b['count']:
            return -1
        elif a['count'] > b['count']:
            return 1
        else:
            return -1
            
    def iter_sublists(self, l):
        n = len(l)+1
        for i in range(n):
            for j in range(i+1, n):
                yield l[i:j]
        
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
