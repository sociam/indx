#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
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

import os, logging, time, traceback, json
from twisted.web import script
from twisted.internet import reactor
from twisted.web.resource import ForbiddenResource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred
import objectstore

from urlparse import urlparse, parse_qs

class WebServer:
    """ Twisted web server for running a single WebBox. """

    def __init__(self, config, base_dir, webbox):
        """ Set up the server with a webbox. """

        self.webboxes = []
        self.webboxes.append(webbox)
 
        # get values to pass to web server
        server_address = config['address']
        if server_address == "":
            server_address = "0.0.0.0"
        server_port = int(config['port'])
        server_hostname = config['hostname']
        server_cert = os.path.join(base_dir,config['ssl_cert'])
        server_private_key = os.path.join(base_dir,config['ssl_private_key'])

        # TODO set up twisted to use gzip compression
        factory = Site(webbox.get_resource())

        # enable ssl (or not)
        try:
            ssl_off = config['ssl_off']
        except Exception as e:
            ssl_off = False

        if ssl_off:
            logging.debug("SSL is OFF, connections to this SecureStore are not encrypted.")
            reactor.listenTCP(server_port, factory)
        else:
            logging.debug("SSL ON.")
            # pass certificate and private key into server
            sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
            reactor.listenSSL(server_port, factory, contextFactory=sslContext)

        scheme = "https"
        if ssl_off:
            scheme = "http"
        server_url = scheme+"://"+server_hostname+":"+str(server_port)+"/"

        # load a web browser once the server has started
        def on_start(arg):
            logging.debug("Server started successfully.")
            if config['load_browser']:
                #time.sleep(2)
                try:
                    import webbrowser
                    webbrowser.open(server_url)
                except Exception as e:
                    pass # no web browser? no problem.
        def start_failed(arg):
            logging.debug("start_failed: "+str(arg))

        # calls the web browser opening function above when the reactor has finished starting up
        d = Deferred()
        d.addCallbacks(on_start, start_failed)
        reactor.callWhenRunning(d.callback, "WebBox HTTP startup")

        # setup triggers on quit
        def onShutDown():
            logging.debug("Got reactor quit trigger, so closing down fourstore.")
            for webbox in self.webboxes:
                webbox.stop()

        reactor.addSystemEventTrigger("during", "shutdown", onShutDown)


    def run(self):
        """ Run the server. """
        reactor.run()


class ObjectWebServer:
    """ Twisted web server for running a test object server. """

    def __init__(self, config):
        """ Set up the server with an object server. """
        self.config = config
        factory = Site(self.resource())
        server_port = int(config['port'])
        reactor.listenTCP(server_port, factory)

    def response(self, environ, start_response):
        """ Respond to a WSGI call. """
        logging.debug("Calling ObjectStore response(): " + str(environ))
        try:
            req_type = environ['REQUEST_METHOD']
            rfile = environ['wsgi.input']
            if "REQUEST_URI" in environ:
                url = urlparse(environ['REQUEST_URI'])
                req_path = url.path
                req_qs = parse_qs(url.query)
            else:
                req_path = environ['PATH_INFO'] 
                req_qs = parse_qs(environ['QUERY_STRING'])

            if req_type == "PUT":
                response = self.do_PUT(rfile, environ, req_path, req_qs)
            elif req_type == "GET":
                response = self.do_GET(environ, req_path, req_qs)
            elif req_type == 'OPTIONS':
                #response =  {"data": "", "status": 200, "reason": "OK", "headers":[("Allow", "GET, PUT, OPTIONS")]}
                response =  {"data": "", "status": 200, "reason": "OK", "headers":[("Allow", "GET"),("Allow", "PUT"),("Allow", "OPTIONS")]}
            else:
                # When you sent 405 Method Not Allowed, you must specify which methods are allowed
                response = {"status": 405, "reason": "Method Not Allowed", "data": "", "headers": [ 
                  ("Allow", "PUT"),
                  ("Allow", "GET"),
                ]}
                
            headers = self._add_headers(response)                
            logging.debug(' :: debug :: Added response headers > ' + repr(response))
            # this is le ugly
            start_response( str(response['status']) + " " + response['reason'] , headers)
            # handle response types
            res_type = type(response['data'])
            logging.debug("Response type is: "+str(res_type))
            if res_type is unicode:
                response['data'] = response['data'].encode('utf8')            
            if res_type is str or res_type is unicode:
                logging.debug("Returning a string")
                return [response['data']]
            else:
                logging.debug("Returning an iter")
                return response['data']
        except objectstore.IncorrectPreviousVersionException as ipve:
            logging.debug("Incorrect previous version")
            start_response("409 Obsolete", [])
            return ["Document obsolete. Please update before putting."]
        except Exception as e:
            logging.debug("Error in WebBox.response(), returning 500: %s, exception is: %s" % (str(e), traceback.format_exc()))
            start_response("500 Internal Server Error", [])
            return [""]

    def _add_headers(self, response):
        # get headers from response if they exist
        headers = response['headers'] if "headers" in response else []        
        # set a content-type
        headers.append( ("Content-type", response['type'] if type in response else 'text/plain') )
        # add CORS headers (blanket allow, for now)
        headers.append( ("Access-Control-Allow-Origin", "*") )
        headers.append( ("Access-Control-Allow-Methods", "GET, PUT, OPTIONS") )
        headers.append( ("Access-Control-Allow-Headers", "Content-Type, origin, accept, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control") )
        headers.append( ("Content-length", response['size'] if "size" in response else len(response['data'] )))
        return headers

    def do_GET(self, environ, req_path, req_qs):
        objs = objectstore.ObjectStore(self.config['connection'])

        if "graph" in req_qs:
            # graph URI specified, so return the objects in that graph
            graph_uri = req_qs["graph"][0]

            obj = objs.get_latest(graph_uri)
            jsondata = json.dumps(obj, indent=2)        
            return {"data": jsondata, "status": 200, "reason": "OK"}
        else:
            # no graph URI specified, so return the list of graph URIs
            uris = objs.get_graphs()
            jsondata = json.dumps(uris, indent=2)

            return {"data": jsondata, "status": 200, "reason": "OK"}


    def do_PUT(self, rfile, environ, req_path, req_qs):
        jsondata = rfile.read()
        objs = json.loads(jsondata)

        if type(objs) == type([]):
            # multi object put
        
            if "graph" not in req_qs:
                return {"data": "Specify a graph URI with &graph=", "status": 404, "reason": "Not Found"}
            graph_uri = req_qs['graph'][0]

            if "previous_version" not in req_qs:
                return {"data": "Specify a previous version with &previous_version=", "status": 404, "reason": "Not Found"}
            prev_version = int(req_qs['previous_version'][0])

            from objectstore import ObjectStore

            objectstore = ObjectStore(self.config['connection'])
            new_version_info = objectstore.add(graph_uri, objs, prev_version)

            return {"data": json.dumps(new_version_info), "status": 201, "reason": "Created", "type": "application/json"}
        else:
            # single object put
            return {"data": "Single object PUT not supported, PUT an array to create/replace a named graph instead.", "status": 404, "reason": "Not Found"}

    def resource(self):
        """ Make a WSGI resource. """
        return WSGIResource(reactor, reactor.getThreadPool(), self.response)

    def run(self):
        """ Run the server. """
        reactor.run()
