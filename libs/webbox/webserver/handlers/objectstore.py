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

import logging, urllib2, uuid, rdflib, os, traceback, mimetypes, shutil, json

from webbox.objectstore import IncorrectPreviousVersionException
from webbox.webserver.handlers.base import BaseHandler
# from journal import Journal

class ObjectStoreHandler(BaseHandler):
    """ Handles calls to an individual box URI (GET/POST/PUT etc.) """

    base_path = 'webbox' # set by the caller

    def do_GET(self,request):
        if "graph" in request.args:
            # graph URI specified, so return the objects in that graph
            graph_uri = request.args["graph"][0]
            obj = self.webbox.object_store.get_latest(graph_uri)
            jsondata = json.dumps(obj, indent=2)
            return self.return_ok(request, {"data":jsondata})
        else:
            # no graph URI specified, so return the list of graph URIs
            uris = self.webbox.object_store.get_graphs()
            jsondata = json.dumps(uris, indent=2)
            return self.return_ok(request, {"data":jsondata})
        pass

    def do_PUT(self,request):
        jsondata = request.content.read()
        objs = json.loads(jsondata)
        if type(objs) == type([]):
            # multi object put            
            if "graph" not in request.args:
                return self.return_bad_request(request,"Specify a graph URI with &graph=")
            if "version" not in request.args:
                return self.return_bad_request(request,"Specify a previous version with &version=")
            graph_uri = request.args['graph'][0]
            prev_version = int(request.args['version'][0])
            try:
                new_version_info = self.webbox.object_store.add(graph_uri, objs, prev_version)
                return self.return_created(request,{"data":new_version_info})                
            except IncorrectPreviousVersionException as ipve:
                logging.debug("Incorrect previous version")
                actual_version = ipve.version
                return self.return_obsolete(request,{"description": "Document obsolete. Please update before putting", '@version':actual_version})            
        else:
            # single object put
            return self.return_bad_request(request,"Single object PUT not supported, PUT an array to create/replace a named graph instead")
        pass

    ## @TODO ::
    def handle_update(self,request):
        """ Handle calls to the Journal update URL. """
        since_repository_hash = None
        if "since" in request.args:
           since_repository_hash = request.args['since'][0]                        
        journal = Journal(os.path.join(self.config['webbox_dir'], self.config['journal']))
        uris_changed = journal.since(since_repository_hash)
        logging.debug("URIs changed: %s" % str(uris_changed))

        if len(uris_changed) > 0:

            ntrips = ""
            for uri in uris_changed:
                query = "CONSTRUCT {?s ?p ?o} WHERE { GRAPH <%s> {?s ?p ?o}}" % uri
                logging.debug("Sending query for triples as: %s " % query)

                result = self.webbox.query_store.query(query, {"Accept": "text/plain"})
                # graceful fail per U

                rdf = result['data']
                ntrips += rdf + "\n"

            # TODO conneg
            rdf_type = "text/plain" # text/plain is n-triples (really)

            return {"data": ntrips, "status": 200, "reason": "OK", "type": rdf_type}

        else:
            # no update
            logging.debug("Client is up to date")
            return {"data": "", "status": 204, "reason": "No Content"}
        pass


ObjectStoreHandler.subhandlers = [
    {
        "prefix": "*",            
        'methods': ['GET'],
        'require_auth': True,
        'require_token': True,
        'handler': ObjectStoreHandler.do_GET,
        'accept':['application/json']
        },
    {
        "prefix": "*",            
        'methods': ['PUT'],
        'require_auth': True,
        'require_token': True,
        'handler': ObjectStoreHandler.do_PUT,
        'accept':['application/json']
        }
    # TODO: 
    # {
    #     "prefix": "update",
    #     'methods': ['GET'],
    #     'require_auth': True,
    #     'require_token': True,
    #     'handler': BoxHandler.handle_update,
    #     'accept':'application/json'
    # },        
]
