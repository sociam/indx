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

import os, logging, time
from wsupdateserver import WSUpdateServer
from twisted.web import script
from twisted.internet import reactor
from twisted.web.resource import ForbiddenResource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred

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
                time.sleep(2)
                import webbrowser
                webbrowser.open(server_url)
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

