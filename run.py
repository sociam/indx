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
import sys, os, logging
import ConfigParser

# add ./libs/ to the python path
sys.path.append(os.path.join(os.path.dirname(__file__), "libs")) 

if __name__ == "__main__":

    # cherrypy http server modules
    import cherrypy
    import cherrypy.wsgiserver
    import cherrypy.wsgiserver.ssl_builtin


    # websockets modules
#    import ws4py.server.cherrypyserver
#    from ws4py.server.handler.threadedhandler import EchoWebSocketHandler



    # read the config file
    config = ConfigParser.ConfigParser()
    config.read("securestore.cfg")

    # set up logging to a file
    logfile = config.get("securestore", "log")

    # show debug messages in log
#    logging.basicConfig(level=logging.DEBUG)

    log_handler = logging.FileHandler(logfile, "a")
    log_handler.setLevel(logging.DEBUG)

    logger = logging.getLogger() # root logger
    logger.addHandler(log_handler)
    logger.debug("Logger initialised")
    logger.setLevel(logging.DEBUG)


    # securestore wsgi app module
    from securestorewsgi import securestore_wsgi


    # get values to pass to cherrypy
    server_address = config.get("securestore","address")
    if server_address == "":
        server_address = "0.0.0.0"
    server_port = int(config.get("securestore","port"))
    server_hostname = config.get("securestore","hostname")
    server_cert = config.get("securestore", "cert")
    server_private_key = config.get("securestore", "private_key")

    # set cherrypy to use gzip compression
    cherrypy.config.update({'gzipfilter.mime_types': ['text/html','text/plain','application/javascript','text/css']})
    cherrypy.config.update({'gzipfilter.on': True})

    # set up cherrypy logging
    access_file = os.path.abspath(".") + os.sep + config.get("securestore","logdir") + os.sep + "access.log"
    error_file = os.path.abspath(".") + os.sep + config.get("securestore","logdir") + os.sep + "error.log"
    cherrypy.config.update({"log.access_file": access_file,
                            "log.error_file" : error_file,
                           })
    cherrypy.config.update({'log.screen': False})
    cherrypy.log.access_file = access_file
    cherrypy.log.error_file = error_file

    # enable websocket support
#    ws4py.server.cherrypyserver.WebSocketPlugin(cherrypy.engine).subscribe()
#    cherrypy.tools.websocket = ws4py.server.cherrypyserver.WebSocketTool()

#    cherrypy.config.update({'tools.websocket.on': True,
#                            'tools.websocket.handler_cls': EchoWebSocketHandler})

    # create a cherrypy server
    server = cherrypy.wsgiserver.CherryPyWSGIServer(
        (server_address, server_port), securestore_wsgi, server_name=server_hostname, numthreads=20)


    # enable ssl (or not)
    try:
        ssl_off = config.get("securestore","ssl_off")
    except Exception as e:
        # not found
        ssl_off = False

    if ssl_off == "true":
        logging.debug("SSL is OFF, connections to this SecureStore are not encrypted.")
    else:
        logging.debug("SSL ON.")
        server.ssl_adapter = cherrypy.wsgiserver.ssl_builtin.BuiltinSSLAdapter(server_cert,server_private_key,None)

    # run the server
    server.start()

