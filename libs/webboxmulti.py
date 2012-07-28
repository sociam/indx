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
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging, os

from twisted.web import script
from twisted.web.static import File, Registry
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.web.server import Site
from twisted.internet.defer import Deferred
from twisted.web.resource import ForbiddenResource, ErrorPage
from twisted.cred.checkers import FilePasswordDB
from twisted.web.guard import DigestCredentialFactory, HTTPAuthSessionWrapper
from twisted.cred.portal import Portal, IRealm
from twisted.web.resource import IResource
from zope.interface import implements

from webbox import WebBox

class WebBoxMulti:
    """ Class to manage and spawn subfolders with different WebBoxes. """

    def __init__(self, config):
        self.config = config
       
        self.host = config['management']['host'] # hostname of the management interface
        self.port = config['management']['port'] # port to listen on
        self.srcdir = config['management']['srcdir'] # source directory of templates

        server_private_key = os.path.join(config['management']['basedir'], config['management']['ssl_key'])
        server_cert = os.path.join(config['management']['basedir'], config['management']['ssl_cert'])

        # allow the config to be readable by .rpy files
        registry = Registry()
        registry.setComponent(WebBoxMulti, self)

        self.root = FileNoDirectoryListings(self.srcdir, registry=registry)
        # make .rpy python cgi
        self.root.processors = {'.rpy': script.ResourceScript}
        self.root.ignoreExt('.rpy')

        # hook in the controller urls to /start /stop etc.
        self.root.putChild("start", WSGIResource(reactor, reactor.getThreadPool(), self.do_start))
        self.root.putChild("stop", WSGIResource(reactor, reactor.getThreadPool(), self.do_stop))

        self.site = Site(self.root)
        sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
        reactor.listenSSL(self.port, self.site, contextFactory=sslContext)

        self.url = "https://"+self.host+":"+str(self.port)

        # load a web browser once the server has started
        def on_start(arg):
            import webbrowser
            logging.debug("Listening on: "+self.url)
            webbrowser.open(self.url)
        def start_failed(arg):
            logging.debug("Startup failed: "+str(arg))

        # calls the web browser opening function above when the reactor has finished starting up
        d = Deferred()
        d.addCallbacks(on_start, start_failed)
        reactor.callWhenRunning(d.callback, "Server startup")

        logging.debug("Starting WebBox management interface on: "+self.url)

        # add webboxes already configured
        self.webboxes = {}
        self.add_webboxes()

        reactor.run()

    def start_wb(self, wb):
        """ Start the webbox with the definition 'wb'. """
        wb['status'] = "running"

        path = "webbox"

        webbox = WebBox(wb['config'])

        resource = FileNoDirectoryListings(os.path.join(self.config['management']['basedir'], "html"))
        resource.putChild(path, WSGIResource(reactor, reactor.getThreadPool(), webbox.response))

        self.root.putChild(wb['directory'], resource)
        self.webboxes[ wb['directory'] ] = webbox


    def stop_wb(self, wb):
        """ Stop the webbox with the defintion 'wb'. """
        wb['status'] = "stopped"
        self.root.putChild(wb['directory'], ErrorPage(404, "Not Found", "Not Found")) # Replace with a 404, can't removeChild.
        webbox = self.webboxes[ wb['directory'] ]
        webbox.stop()


    def add_webboxes(self):
        """ Add the webboxes from the configuration. """
        for wb in self.config['webboxes']:
            self.start_wb(wb)

    def get_config(self):
        for wb in self.config['webboxes']:
            wb['url_scheme'] = self.config['url_scheme']
            wb['port'] = self.config['management']['port'] 
            wb['host'] = self.config['management']['host']
            if wb['status'] == "stopped":
                wb['modify'] = "Start"
                wb['modify_action'] = "start"
            elif wb['status'] == "running":
                wb['modify'] = "Stop"
                wb['modify_action'] = "stop"

        return self.config

    def do_start(self, environment, start_response):
        directory = environment['PATH_INFO'][1:] # remove leading slash
        for wb in self.config['webboxes']:
            if directory == wb['directory']:
                self.start_wb(wb)
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That webbox was not found."]

    def do_stop(self, environment, start_response):
        directory = environment['PATH_INFO'][1:] # remove leading slash
        for wb in self.config['webboxes']:
            if directory == wb['directory']:
                self.stop_wb(wb)
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That webbox was not found."]


# Disable directory listings
class FileNoDirectoryListings(File):
    def directoryListing(self):
        return ForbiddenResource()
