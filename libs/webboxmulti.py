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

import logging, os, json, re
from urlparse import parse_qs

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
from webboxsetup import WebBoxSetup

class WebBoxMulti:
    """ Class to manage and spawn subfolders with different WebBoxes. """

    def __init__(self, config):
        self.config = config
        self.config_file = config['config_filename']
       
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
        self.root.putChild("new", WSGIResource(reactor, reactor.getThreadPool(), self.do_new))

        admin = FileNoDirectoryListings(self.srcdir + os.sep + "admin", registry=registry)
        self.admin = admin
        # make .rpy python cgi
        self.admin.processors = {'.rpy': script.ResourceScript}
        self.admin.ignoreExt('.rpy')
        self.admin.putChild("start", WSGIResource(reactor, reactor.getThreadPool(), self.do_start))
        self.admin.putChild("stop", WSGIResource(reactor, reactor.getThreadPool(), self.do_stop))

        class MgmtRealm(object):
            implements(IRealm)
            def requestAvatar(self, avatarId, mind, *interfaces):
                if IResource in interfaces:
                    return (IResource, admin, lambda: None)
                logging.debug("Error in requestAvatar.")

        realm = MgmtRealm()
        portal = Portal(realm, [FilePasswordDB(self.config['htdigest'])]) #FIXME insecure passwords
        credentialFactory = DigestCredentialFactory("md5", "webbox") # webbox is the "realm" of the htdigest
        adminAuth = HTTPAuthSessionWrapper(portal, [credentialFactory])

        self.root.putChild("admin", adminAuth)

        self.site = Site(self.root)
        sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
        reactor.listenSSL(self.port, self.site, contextFactory=sslContext)

        self.url = "https://"+self.host+":"+str(self.port)

        # load a web browser once the server has started
        def on_start(arg):
            import webbrowser
            logging.debug("Listening on: "+self.url)
            #webbrowser.open(self.url)
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

    def invalid_name(self, name):
        """ Check if this name is safe (only contains a-z0-9_-). """ 
        return re.match("^[a-z0-9_-]*$", name) is None


    def new_wb(self, name):
        """ Create a new webbox with this name. """

        name = name.lower()

        if self.invalid_name(name):
            raise Exception("WebBox name contains illegal characters.")

        webbox_dir = os.path.abspath(self.config['wbs_dir'] + os.sep + name)
        if os.path.exists(webbox_dir):
            raise Exception("WebBox already exists")

        kbname = "webboxmulti_"+name

        next_port = self.config['next_port']
        self.config['next_port'] += 2

        fs_port = next_port
        ws_port = next_port + 1

        setup = WebBoxSetup()
        setup.setup(webbox_dir, "webbox.json.default", kbname, fs_port = fs_port, ws_port = ws_port) # directory, default config, kbname

        self.config['webboxes'].append( {"directory": name, "status": "stopped", "location": webbox_dir } )
        self.save_config()


    def save_config(self):
        """ Save the current configuration to disk. """
        conf_fh = open(self.config_file, "w")
        json.dump(self.config, conf_fh, indent=4)
        conf_fh.close()


    def start_wb(self, wb):
        """ Start the webbox with the definition 'wb'. """
        wb['status'] = "running"

        path = "webbox"

        # load configuration into 'config' variable
        webbox_config = wb['location'] + os.sep + "webbox.json"
        logging.debug("Loading configuration from: %s" % webbox_config)
        conf_fh = open(webbox_config, "r")
        config = json.loads(conf_fh.read())
        conf_fh.close()

        config['webbox']['url'] = self.config['url_scheme'] + "://" + self.config['management']['host'] + ":" + str(self.config['management']['port']) + "/" + wb['directory'] + "/" + path
        config['webbox']['webbox_dir'] = wb['location']
        config['webbox']['4store']['delay'] = 2 # force a delay

        webbox = WebBox(config['webbox'])

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
        """ Make sure the webbox configs have the current host config details correctly. """
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
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/admin/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That webbox was not found."]

    def do_stop(self, environment, start_response):
        directory = environment['PATH_INFO'][1:] # remove leading slash
        for wb in self.config['webboxes']:
            if directory == wb['directory']:
                self.stop_wb(wb)
                start_response("302 Found", [("Content-type", "text/html"), ("Location", "/admin/")] )
                return []

        start_response("404 Not Found", [("Content-type", "text/html")] )
        return ["That webbox was not found."]

    def do_new(self, environment, start_response):
        """ WSGI call to create a new WebBox. """

        try:
            name = parse_qs(environment['QUERY_STRING'])['name'][0]
            logging.debug("Creating new webbox with name: "+name)
            # create
            self.new_wb(name)
            # and run
            for wb in self.config['webboxes']:
                if name == wb['directory']:
                    self.start_wb(wb)

            start_response("302 Found", [("Content-type", "text/html"), ("Location", "/")] )
            return []
        except Exception as e:
            # TODO show the user something nice here / redirect them to an error page
            logging.error("Error in do_new: " + str(e))
            start_response("500 Internal Server Error", [])
            return [""]


# Disable directory listings
class FileNoDirectoryListings(File):
    def directoryListing(self):
        return ForbiddenResource()
