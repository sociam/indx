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
from urlparse import urlparse, parse_qs
import ConfigParser


# add ./libs/ to the python path
sys.path.append(os.path.join(os.path.dirname(__file__), "libs")) 

# per user webbox configuration and data
webbox_dir = os.path.expanduser('~'+os.sep+".webbox")
webbox_config = webbox_dir + os.sep + "webbox.json"

if __name__ == "__main__":

    # twisted wsgi server modules
    from twisted.internet import reactor
    from twisted.web import resource
    from twisted.web.server import Site
    from twisted.web.util import Redirect
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

    # use 4store query_store
    from fourstore import FourStore
    query_store = FourStore(config)

    webbox_path = "webbox"

    # WebBox WSGI handler
    def webbox_wsgi(environ, start_response):
        logging.debug("WEBBOX call")
        global query_store
        global config
        global webbox_path

        from webbox import WebBox
        wb = WebBox("/"+webbox_path, environ, query_store, config)
        response = wb.response()

        headers = []
        if "type" in response:
            headers.append( ("Content-type", response['type']) )
        else:
            headers.append( ("Content-type", "text/plain") )

        from journal import Journal
        # put repository version weak ETag header
        # journal to load the original repository version
        j = Journal(os.path.join(config['webbox_dir'],config['webbox']['data_dir'],config['webbox']['journal_dir']), config['webbox']['journalid'])
        
        latest_hash = j.get_version_hashes() # current and previous
        
        if latest_hash['current'] is not None:
            headers.append( ('ETag', "W/\"%s\""%latest_hash['current'] ) ) # 'W/' means a Weak ETag
        if latest_hash['previous'] is not None:
            headers.append( ('X-ETag-Previous', "W/\"%s\""%latest_hash['previous']) ) # 'W/' means a Weak ETag

        start_response(str(response['status']) + " " + response['reason'], headers)
        return response['data']


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
    # root handler is a static web server
    resource = File(os.path.join(os.path.dirname(__file__), "html"))

    # set up path handlers e.g. /webbox
    reactor.suggestThreadPoolSize(30)
    resource.putChild(webbox_path, WSGIResource(reactor, reactor.getThreadPool(), webbox_wsgi))
    factory = Site(resource)

    # enable ssl (or not)
    try:
        ssl_off = config['webbox']['ssl_off']
        ssl_off = (ssl_off == "true")
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

