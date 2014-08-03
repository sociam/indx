#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
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
import json
import traceback
import negotiator
from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
from indx.reactor import IndxRequest
from rdflib.namespace import Namespace, NamespaceManager
from rdflib.graph import Graph
from rdflib.term import URIRef, Literal

class IndxWebHandler(Resource):
    """ Acts as a handler for the web server, and passes off requests to the IndxReactor. """

    def __init__(self, indx_reactor, name, server_id):
        Resource.__init__(self)
        self.indx_reactor = indx_reactor
        self.isLeaf = True
        self.name = name # path name, e.g. box name
        self.server_id = server_id

        self.defaultType = "application/json"
        self.defaultHandler = self.indxJSONRender

        # ordered by preference
        self.contentTypesHandlers = [
            ("application/json", self.indxJSONRender),
            ("text/json", self.indxJSONRender),
            ("application/ld+json", self.jsonLDRender),
            ("application/rdf+xml", self.rdfXMLRender), #xml
            ("text/n3", self.rdfN3Render), #n3 
            ("text/turtle", self.rdfTurtleRender), #turtle
            ("application/n-triples", self.rdfNTriplesRender), #nt
        ]

    def render(self, request):

        uri = request.uri
        method = request.method
        path = request.path
        params = {
            "headers": request.headers,
            "args": request.args,
        }

        logging.debug("IndxWebHandler, request, path: {0}".format(path))

        def callback(indx_response):
            logging.debug("IndxWebHandler, request callback")

            try:
                accept = request.getHeader("Accept")

                acceptable = []
                for typ_tuple in self.contentTypesHandlers:
                    typ = typ_tuple[0]
                    acceptable.append(negotiator.AcceptParameters(negotiator.ContentType(typ), negotiator.Language("en")))

                default_params = negotiator.AcceptParameters(negotiator.ContentType(self.defaultType), negotiator.Language("en"))
                cn = negotiator.ContentNegotiator(default_params, acceptable)
                negotiated = cn.negotiate(accept, "en")
                if negotiated:
                    chosenType = negotiated.content_type.mimetype()
                else:
                    chosenType = self.defaultType

                for handler in self.contentTypesHandlers:
                    if handler[0] == chosenType:
                        return handler[1](request, indx_request, indx_response, chosenType)
                
                return self.defaultHander(request, indx_request, indx_response, self.defaultType)

            except Exception as e:
                logging.debug("IndxWebHandler error sending response: {0},\ntrace: {1}".format(e, traceback.format_exc()))

        indx_request = IndxRequest(uri, method, self.name, path, params, request.content, request.getSession().uid, callback, request.getClientIP(), self.server_id)
        self.indx_reactor.incoming(indx_request)
        return NOT_DONE_YET


    def indxJSONRender(self, request, indx_request, indx_response, typ):
        """ Render the output in INDX JSON response format. """
        response = {"message": indx_response.message, "code": indx_response.code}
        response.update(indx_response.data)
        responsejson = json.dumps(response)

        if not request._disconnected:
            request.setResponseCode(indx_response.code, indx_response.message)
            request.setHeader("Content-Type", typ)
            request.setHeader("Content-Length", len(responsejson))

            for key, value in indx_response.headers.items():
                request.setHeader(key, value)

            request.write(responsejson)
            request.finish()
            logging.debug('In IndxWebHandler just called request.finish() with code %d in indxJSONRender' % indx_response.code)
        else:
            logging.debug('In IndxWebHandler didnt call request.finish(), because it was already disconnected (in indxJSONRender)')


    def jsonLDRender(self, request, indx_request, indx_response, typ):
        """ Render the output in JSON-LD response format (without being wrapped in INDX message/code). """
        response = indx_response.data
        responsejson = json.dumps(response)

        if not request._disconnected:
            request.setResponseCode(indx_response.code, indx_response.message)
            request.setHeader("Content-Type", typ)
            request.setHeader("Content-Length", len(responsejson))

            for key, value in indx_response.headers.items():
                request.setHeader(key, value)

            request.write(responsejson)
            request.finish()
            logging.debug('In IndxWebHandler just called request.finish() with code %d in jsonLDRender' % indx_response.code)
        else:
            logging.debug('In IndxWebHandler didnt call request.finish(), because it was already disconnected (in jsonLDRender)')

    def rdfXMLRender(self, request, indx_request, indx_response, typ):
        return self.rdfRender(request, indx_request, indx_response, typ, "xml")

    def rdfN3Render(self, request, indx_request, indx_response, typ):
        return self.rdfRender(request, indx_request, indx_response, typ, "n3")

    def rdfTurtleRender(self, request, indx_request, indx_response, typ):
        return self.rdfRender(request, indx_request, indx_response, typ, "turtle")

    def rdfNTriplesRender(self, request, indx_request, indx_response, typ):
        return self.rdfRender(request, indx_request, indx_response, typ, "nt")


    """ RDF conversion functions. """
    #TODO move out to another module


    def rdfRender(self, request, indx_request, indx_response, typ, output_format):
        """ Convert objects to an RDF graph, serialize in the specified format and write them as a response. """
        # indx_response.data

        logging.debug("IndxWebHandler rdfXMLRender data: {0}".format(indx_response.data))

        if not("data" in indx_response.data) or indx_response.code < 200 or indx_response.code > 299:
            # means a 500 or something
            response = ""
            if not request._disconnected:
                request.setResponseCode(indx_response.code, indx_response.message)
                request.setHeader("Content-Type", typ)
                request.setHeader("Content-Length", len(response))

                for key, value in indx_response.headers.items():
                    request.setHeader(key, value)

                request.write(response)
                request.finish()
                logging.debug('In IndxWebHandler just called request.finish() with code %d in rdfRender' % indx_response.code)
            else:
                logging.debug('In IndxWebHandler didnt call request.finish(), because it was already disconnected (in rdfRender)')
            return

        base_uri = indx_request.uri.split("/{0}".format(indx_request.base_path))[0] + "/{0}".format(indx_request.base_path) + "/"
        graph = self._objsToRDF(base_uri, indx_response.data['data'].items())
        response = graph.serialize(format=output_format)

        if not request._disconnected:
            request.setResponseCode(indx_response.code, indx_response.message)
            request.setHeader("Content-Type", typ)
            request.setHeader("Content-Length", len(response))

            for key, value in indx_response.headers.items():
                request.setHeader(key, value)

            request.write(response)
            request.finish()
            logging.debug('In IndxWebHandler just called request.finish() with code %d in rdfRender' % indx_response.code)
        else:
            logging.debug('In IndxWebHandler didnt call request.finish(), because it was already disconnected (in rdfRender)')


    def _objsToRDF(self, base_uri, obj_dict):
        graph = Graph()
        nsman = NamespaceManager(graph)

        for obj_id, obj in obj_dict:
            logging.debug("IndxWebHandler _objsToRDF obj_id: {0}, obj: {1}".format(obj_id, obj))
            if obj_id[0] != "@":
                
                obj_uriref = URIRef("{0}{1}".format(base_uri, obj_id))

                for pred in obj.keys():
                    if pred[0] == "@":
                        continue

                    # XXX TODO do something better
                    if pred.startswith("http://") or pred.startswith("https://"):
                        pred_uriref = URIRef(pred)
                    else:
                        pred_uriref = URIRef(base_uri + "property/" + pred)

                    for val in obj[pred]:
                        if "@id" in val:
                            value = val["@id"]

                            # XXX TODO do something better
                            if value.startswith("http://") or value.startswith("https://"):
                                val_uriref = URIRef(value)
                            else:
                                val_uriref = URIRef(base_uri + "value/" + value)

                            graph.add( (obj_uriref, pred_uriref, val_uriref) )
                        elif "@value" in val:
                            value = val["@value"]
                            graph.add( (obj_uriref, pred_uriref, Literal(value)) )
                        else:
                            continue

        return graph

