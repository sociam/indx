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

import logging, os

from twisted.web import script
from twisted.web.static import File, Registry
from twisted.web.vhost import NameVirtualHost
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.web.server import Site
from twisted.internet.defer import Deferred
from twisted.web.resource import ForbiddenResource
from twisted.cred.checkers import FilePasswordDB
from twisted.web.guard import DigestCredentialFactory, HTTPAuthSessionWrapper
from twisted.cred.portal import Portal, IRealm
from twisted.web.resource import IResource
from zope.interface import implements

from webbox import WebBox

class WebBoxVHost:
    """ Class to manage and spawn Virtual Hosts, each with a different WebBox. """

    def __init__(self, config):
        self.config = config
       
        self.host = config['management']['host'] # hostname of the management interface
        self.port = config['management']['port'] # port to listen on
        self.srcdir = config['management']['srcdir'] # source directory of templates
        # TODO ssl port? or multiple ports?

        self.vhost = NameVirtualHost()

        # allow the config to be readable by .rpy files
        registry = Registry()
        registry.setComponent(WebBoxVHost, self)

        root = FileNoDirectoryListings(self.srcdir, registry=registry)
        # make .rpy python cgi
        root.processors = {'.rpy': script.ResourceScript}
        root.ignoreExt('.rpy')

        # hook in the vhost controller urls to /start /stop etc.
        root.putChild("start", WSGIResource(reactor, reactor.getThreadPool(), self.do_start))
        root.putChild("stop", WSGIResource(reactor, reactor.getThreadPool(), self.do_stop))

        class MgmtRealm(object):
            implements(IRealm)
            def requestAvatar(self, avatarId, mind, *interfaces):
                if IResource in interfaces:
                    return (IResource, root, lambda: None)
                logging.debug("Error in requestAvatar.")

        realm = MgmtRealm()
        portal = Portal(realm, [FilePasswordDB(config['htdigest'])]) #FIXME insecure passwords
        credentialFactory = DigestCredentialFactory("md5", "webbox") # webbox is the "realm" of the htdigest
        rootAuth = HTTPAuthSessionWrapper(portal, [credentialFactory])
        self.vhost.addHost(self.host, rootAuth)

        self.site = Site(self.vhost)
        reactor.listenTCP(self.port, self.site)
        # TODO ssl port?

        self.url = "http://"+self.host+":"+str(self.port)

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

        # add vhosts already configured
        self.webboxes = {}
        self.add_vhosts()

        reactor.run()

    def start_vhost(self, vhost):
        """ Start the vhost with the definition 'vhost'. """
        vhost['status'] = "running"

        path = "webbox"

        webbox = WebBox(vhost['config'])

        resource = FileNoDirectoryListings(os.path.join(self.config['management']['basedir'], "html"))
        resource.putChild(path, WSGIResource(reactor, reactor.getThreadPool(), webbox.response))

        self.vhost.addHost(vhost['host'], resource)
        self.webboxes[ vhost['host'] ] = webbox


    def stop_vhost(self, vhost):
        """ Stop the vhost with the defintion 'vhost'. """
        vhost['status'] = "stopped"
        self.vhost.removeHost(vhost['host'])
        webbox = self.webboxes[ vhost['host'] ]
        webbox.stop()


    def add_vhosts(self):
        """ Add the vhosts from the configuration. """
        for vhost in self.config['vhosts']:
            self.start_vhost(vhost)

    def get_config(self):
        for vhost in self.config['vhosts']:
            vhost['url_scheme'] = self.config['url_scheme']
            vhost['port'] = self.config['management']['port'] 
            if vhost['status'] == "stopped":
                vhost['modify'] = "Start"
                vhost['modify_action'] = "start"
            elif vhost['status'] == "running":
                vhost['modify'] = "Stop"
                vhost['modify_action'] = "stop"

        return self.config

    def do_start(self, environment, start_response):
        host = environment['PATH_INFO'][1:] # remove leading slash
        for vhost in self.config['vhosts']:
            if host == vhost['host']:
                self.start_vhost(vhost)
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That virtual host was not found."]

    def do_stop(self, environment, start_response):
        host = environment['PATH_INFO'][1:] # remove leading slash
        for vhost in self.config['vhosts']:
            if host == vhost['host']:
                self.stop_vhost(vhost)
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That virtual host was not found."]


# Disable directory listings
class FileNoDirectoryListings(File):
    def directoryListing(self):
        return ForbiddenResource()
