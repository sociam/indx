#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
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

import logging, traceback
import logging, urllib2, uuid, rdflib, os, traceback, mimetypes, shutil, json
from twisted.web.resource import Resource
from webbox.webserver.session import WebBoxSession, ISession
from webbox.webserver.handlers.base import BaseHandler
from webbox.objectstore_async import IncorrectPreviousVersionException

class BoxHandler(BaseHandler):
    base_path = ''
    def options(self, request):
        self.return_ok(request)

    def get_object_ids(self, request):
        """ Get a list of object IDs in this box. """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        store = token.store

        try:
            logging.debug("calling get_object_ids on store")
            token.store.get_object_ids().addCallback(lambda results: self.return_ok(request, results))
        except Exception as e:
            return self.return_internal_error(request)

    def query(self, request):
        """ Perform a query against the box, and return matching objects. """
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)

        store = token.store

        try:
            q = json.loads(request.args['q'][0])
        except Exception as e:
            return self.return_bad_request(request, "Specify query as query string parameter 'q' as valid JSON")

        try:
            logging.debug("querying store with q: "+str(q))
            token.store.query(q).addCallback(lambda results: self.return_ok(request, {"data": results}))
        except Exception as e:
            return self.return_internal_error(request)


    def do_GET(self,request):
        token = self.get_token(request)
        if not token:
            return self.return_forbidden(request)
        store = token.store
        return store.get_latest().addCallback(lambda obj: self.return_ok(request, {"data":json.dumps(obj, indent=2)}))
    
    def do_PUT(self,request):
        token = self.get_token(request)
        logging.debug('token {0}'.format(token))
        if not token:
            return self.return_forbidden(request)
        args = self.get_post_args(request)
        store = token.store
        jsondata = args['data'][0]
        objs = json.loads(jsondata)
        if type(objs) == type([]):
            # multi object put            
            if "version" not in args:
                return self.return_bad_request(request,"Specify a previous version with &version=")
            prev_version = int(args['version'][0])
            d = store.add(objs, prev_version)

            def handle_add_error(failure):
                """ Handle an error on add (this is the errback). """ #TODO move this somewhere else?
                failure.trap(IncorrectPreviousVersionException, Exception)
                err = failure.value
                if isinstance(err, IncorrectPreviousVersionException):
                    logging.debug("Incorrect previous version")
                    actual_version = err.version
                    return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
                else:
                    logging.debug("Exception trying to add to store.")
                    return self.return_internal_error(request)

            d.addCallbacks(lambda new_version_info: self.return_created(request,{"data":new_version_info}), # callback
                handle_add_error) #errback
        else:
            # single object put
            return self.return_bad_request(request,"Single object PUT not supported, PUT an array to create/replace a named graph instead")
        pass
    
    # ## @TODO ::
    # def handle_update(self,request):
    #     """ Handle calls to the Journal update URL. """
    #     since_repository_hash = None
    #     if "since" in request.args:
    #        since_repository_hash = request.args['since'][0]                        
    #     journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
    #     uris_changed = journal.since(since_repository_hash)
    #     logging.debug("URIs changed: %s" % str(uris_changed))

    #     if len(uris_changed) > 0:

    #         ntrips = ""
    #         for uri in uris_changed:
    #             query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
    #             logging.debug("Sending query for triples as: %s " % query)

    #             result = self.webbox.query_store.query(query, {"Accept": "text/plain"})
    #             # graceful fail per U

    #             rdf = result['data']
    #             ntrips += rdf + "\n"

    #         # TODO conneg
    #         rdf_type = "text/plain" # text/plain is n-triples (really)

    #         return {"data": ntrips, "status": 200, "reason": "OK", "type": rdf_type}

    #     else:
    #         # no update
    #         logging.debug("Client is up to date")
    #         return {"data": "", "status": 204, "reason": "No Content"}
    #     pass

BoxHandler.subhandlers = [
    {
        "prefix": "get_object_ids",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': BoxHandler.get_object_ids,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "query",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': BoxHandler.query,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "*",            
        'methods': ['GET'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.do_GET,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "*",            
        'methods': ['PUT'],
        'require_auth': False,
        'require_token': True,
        'handler': BoxHandler.do_PUT,
        'accept':['application/json'],
        'content-type':'application/json'        
        },
    {
        'prefix':'*',
        'methods': ['OPTIONS'],
        'require_auth': False,
        'require_token': False,
        'handler': BaseHandler.return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        }
]

        
