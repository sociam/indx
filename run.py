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
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


# import core modules
import sys, os, logging, json
import ConfigParser

# add ./libs/ to the python path
sys.path.append(os.path.join(os.path.dirname(__file__), "libs")) 

# per user webbox configuration and data
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
webbox_config = webbox_dir + os.sep + "webbox.json"

if __name__ == "__main__":

    # twisted wsgi server modules
    from twisted.internet import reactor
    from twisted.web.server import Site
    from twisted.web.static import File
    from twisted.web.wsgi import WSGIResource
    from twisted.internet import reactor, ssl
    from twisted.internet.defer import Deferred

    # read the config file
    conf_fh = open(webbox_config, "r")
    config = json.load(conf_fh)
    conf_fh.close()

    # add the webbox path to the config
    config['webbox_dir'] = webbox_dir

    # set up logging to a file
    logdir = os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['log_dir'])
    logfile = os.path.join(logdir, config['webbox']['log'])

    # show debug messages in log
    log_handler = logging.FileHandler(logfile, "a")
    log_handler.setLevel(logging.DEBUG)

    logger = logging.getLogger() # root logger
    logger.addHandler(log_handler)
    logger.debug("Logger initialised")
    logger.setLevel(logging.DEBUG)

    # securestore wsgi app
    from securestorewsgi import SecureStoreWSGI 


    # import SecureStore module
    from securestore import SecureStore
    ss = SecureStore(config)

    # register the WebBox module under the name "webbox" - this name is then used in the config file to define paths
    from webbox import WebBox
    ss.enable_module(WebBox, "webbox")
    ss.register_module("webbox", "/webbox")

    # register the certificate generation JSON module
    from certificates import Certificates
    ss.enable_module(Certificates, "certificates")
    ss.register_module("certificates", "/certificates")

    # register the journal update module
    from journalmodule import JournalModule
    ss.enable_module(JournalModule, "journal")
    ss.register_module("journal", "/update")

    # register and set the query store to 4store
    from fourstore import FourStore
    ss.set_query_store(FourStore)

    # register and set the query store to the in-memory pure python CwmStore
    #from cwm import CwmStore
    #ss.setQueryStore(CwmStore)

    # WSGI application
    def securestore_wsgi(environ, start_response):
        global ss
        global config
        ssw = SecureStoreWSGI(environ, start_response, config, ss)
        return [ssw.respond()]

    # get values to pass to web server
    server_address = config['webbox']['address']
    if server_address == "":
        server_address = "0.0.0.0"
    server_port = int(config['webbox']['port'])
    server_hostname = config['webbox']['hostname']
    server_cert = os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['ssl_cert'])
    server_private_key =  os.path.join(webbox_dir,config['webbox']['data_dir'],config['webbox']['ssl_private_key'])

    # TODO set up twisted to use gzip compression

    # create a twisted web and WSGI server
    resource = WSGIResource(reactor, reactor.getThreadPool(), securestore_wsgi)
    factory = Site(resource)

    # enable ssl (or not)
    try:
        ssl_off = config['webbox']['ssl_off']
    except Exception as e:
        # not found
        ssl_off = False

    if ssl_off == "true":
        logging.debug("SSL is OFF, connections to this SecureStore are not encrypted.")
        reactor.listenTCP(server_port, factory)
    else:
        logging.debug("SSL ON.")
        sslContext = ssl.DefaultOpenSSLContextFactory(server_private_key, server_cert)
        reactor.listenSSL(server_port, factory, contextFactory=sslContext)

    # load a web browser once the server has started
    def on_start(arg):
        print "on_start: "+str(arg)
        import webbrowser
        webbrowser.open(config['webbox']['url'])
    def start_failed(arg):
        print "start_failed: "+str(arg)

    # calls the web browser opening function above when the reactor has finished starting up
    d = Deferred()
    d.addCallbacks(on_start, start_failed)
    reactor.callWhenRunning(d.callback, "WebBox HTTP startup")

    # run the twisted server
    reactor.run()

