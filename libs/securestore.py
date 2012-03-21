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


import socket, os, urllib, posixpath, shutil, mimetypes, re, logging

from SocketServer import BaseServer
from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
from SimpleHTTPServer import SimpleHTTPRequestHandler
from OpenSSL import SSL
from urlparse import urlparse, parse_qs

from hashstorage import HashStorage
from vaults import Vaults
from securestoreproxy import SecureStoreProxy
from webboxx509 import WebboxX509

__version__ = "0.1" # SecureStore version

class SecureStore:
    def __init__(self, config):
        self.config = config
        self.enabled_modules = {}
        self.registered_modules = {}
        self.query_store = None
        self.url = self.config.get("securestore", "url")
        self.filedir = self.config.get("securestore", "filedir")

        logging.debug("New SecureStore inited.")

        """ Here you put the server-level objects """
        self.hashstore = self.config.get("securestore","hashstore")
        self.docroot = os.getcwd() + "/html" # TODO configurable docroot ?
        self.certstore = WebboxX509(self.config.get("securestore","certstore"))

    def enable_module(self, module, name):
        """ Enable a module, e.g. that python module "module" has a name "name". """
        self.enabled_modules[name] = module

    def register_module(self, module_name, path):
        """ Register a URL path to be served by a named module. """
        if module_name in self.enabled_modules:
            self.registered_modules[path] = module_name
        else:
            logging.error("Could not register module '%s', it has not been enabled with enable_module." % module_name)

    def set_query_store(self, module_name):
        """ Set the query store and pass it the configuration so it can read its own settings."""
        self.query_store = module_name(self.config) # create a new object


    def request(self, environment, start_response):
        """ Handle a WSGI request. """

        logging.debug(str(environment))

        ss_handler = SecureStoreRequestHandler(self, environment, start_response)

        # TODO call the functions directly instead of using IFs?
        if environment['REQUEST_METHOD'] == "GET":
            return ss_handler.do_GET()
        elif environment['REQUEST_METHOD'] == "PUT":
            return ss_handler.do_PUT()
        elif environment['REQUEST_METHOD'] == "POST":
            return ss_handler.do_POST()
        elif environment['REQUEST_METHOD'] == "HEAD":
            return ss_handler.do_HEAD()
        elif environment['REQUEST_METHOD'] == "OPTIONS":
            return ss_handler.do_OPTIONS()
        else:
            # default response
            start_response("404", [('Content-Type','text/plain')])
            return "Not Found"


class SecureStoreRequestHandler:
    """ Handles HTTP requests for the WSGI server (i.e. used by the SecureStoreServer object). A new instance is created per connection. """

    server_version = "SecureStore/" + __version__

    if not mimetypes.inited:
        mimetypes.init() # try to read system mime.types

    extensions_map = mimetypes.types_map.copy()
    extensions_map.update({
        '': 'application/octet-stream', # Default
        '.py': 'text/plain',
        '.c': 'text/plain',
        '.h': 'text/plain',
        '.js': 'text/javascript',
        '.jpg': 'image/jpeg',
        '.html': 'text/html',
        '.woff': 'application/x-font-woff',
        })


    def __init__(self, server, environment, start_response):
        """ Here you put the connection-level (i.e. per user) objects """
        self.server = server
        self.environment = environment
        self.start_response = start_response

        # maybe put this in SecureHTTPServer and init once per server?
        self.proxy = SecureStoreProxy(self.server.config, self.server.hashstore, self.server.query_store) # i.e. SecureHTTPServer.config

        # put here because this will be per-user
        self.vaults = Vaults(self.server.config.get("securestore","vaults"))

        self.template_data = {'vaults': []}
        self.template_data['vaults'] = self.vaults.get_all()
        self.web_prefix = "/web"

        url = urlparse(self.environment['REQUEST_URI'])
        self.path = url.path
        self.req_qs = parse_qs(url.query)

        # these get overridden by the send_response and send_header methods, and sent by end_headers
        self.response_headers = []
        self.response_code = None


    def serve_modules(self, req_type):
        """ See if the current path is served by any of the registered modules. """
        # TODO handle overlapping paths?

        logging.debug("serve_modules")

        for path in self.server.registered_modules:
            module = self.server.registered_modules[path]
            module_class = self.server.enabled_modules[module]

            logging.debug("path: " + path)

            if self.path.startswith(path):
                logging.debug("module '%s' matched" % str(module))

                wb = module_class(self.server.url, path, req_type, self.path, self.req_qs, self.environment, self.proxy, self.server.filedir, self.server.config)
                response = wb.response(self.environment['wsgi.input'])

                if response is not None:
                    return response

        return None

    def serve_commands(self):
        if self.path.startswith(self.web_prefix + "/newvault"):
            if self.req_qs.has_key('vault_name') and self.req_qs.has_key('vault_shortname'):
                shortname = self.req_qs['vault_shortname'][0]
                name = self.req_qs['vault_name'][0]
                self.vaults.create(shortname, name)
            else:
                pass # FIXME error?
            return self.redirect(self.web_prefix + "/")
        elif self.path.startswith(self.web_prefix + "/sethash"):
            if self.req_qs.has_key('hash') and self.req_qs.has_key('vault_shortname'):
                shortname = self.req_qs['vault_shortname'][0]
                hashed = self.req_qs['hash'][0]
                response = self.vaults.set_key(shortname, hashed)
                if response == True:
                    return self.redirect(self.web_prefix + "/vaults/" + shortname)
                logging.error("error setting key: " + response)
                return self.redirect(self.web_prefix + "/vaults/" + shortname)
            else:
                return self.redirect(self.web_prefix + "/vaults")

        elif self.path.startswith(self.web_prefix + "/vaults"):
            try:
                matches = re.match(self.web_prefix + '\/vaults\/(.*)$', self.path)
                vault_name = matches.group(1)
                
                vault_template = open(self.server.docroot + "/vault.pt")

                template = PageTemplate(vault_template.read())
                self.template_data['vault'] = self.vaults.get(vault_name)
                rendered = template.render(**self.template_data)

                self.send_response(200)
                self.end_headers()

                return rendered
            except Exception as e:
                logging.error(str(e))

        return None

    def send_response(self, code):
        self.response_code = code

    def send_header(self, key, value):
        self.response_headers.append( (key, value) ) # add the k/v tuple

    def end_headers(self):
        self.start_response(str(self.response_code), self.response_headers)

    def redirect(self, redirect_to):
        self.send_response(301)
        self.send_header("Location", redirect_to) 
        logging.debug("sending location as: " + redirect_to)
        self.end_headers()

        return "Redirected to: "+redirect_to

    def do_OPTIONS(self):
        logging.debug("Sending 200 response to OPTIONS")
        self.send_response(200)
        self.send_header("Allow", "PUT")
        self.send_header("Allow", "GET")
        self.send_header("Allow", "POST")
        self.end_headers() 
    
        return ""

    def do_GET(self):
        """Serve a GET request."""

        if self.path == "/":
            return self.redirect(self.web_prefix + "/")
        if self.path == "/favicon.ico":
            return self.redirect(self.web_prefix + "/favicon.ico")
        if self.path == self.web_prefix:
            return self.redirect(self.web_prefix + "/")

        logging.debug("comparing path: %s with web_prefix: %s" % (self.path, self.web_prefix))

        if self.path.startswith(self.web_prefix + "/"):
            logging.debug("GET starts with web prefix")

            self.path = self.path[len(self.web_prefix):] # strip off /static

            # if the request if a command, do that
            command_returned = self.serve_commands()
            if command_returned is not None:
                return comment_returned

            # try to serve a file
            f = self.send_head() # does send_response etc, but not end_headers.

            filedata = ""
            if f is not None:
                filedata = self.copyfile(f)
                f.close()

            self.send_header("Content-Length", str(len(filedata)))
            self.end_headers()
            return filedata

        else:
            logging.debug("req path NOT with web prefix: " + self.web_prefix)
            # TODO do something else - serve linked data from our tool

            # get key
            key = None
            if self.req_qs.has_key('key'):
                key = self.req_qs['key'][0]

            self.proxy.set_key(key)

            if self.path.startswith("/query"):
                # sparql query
                logging.debug("sparql query, arg in is: "+str(self.req_qs))

                args = {'query': self.req_qs['query'][0]} # TODO support more? 

                logging.debug("sparql query, arg out is: "+str(args))
                response = self.proxy.SPARQLQuery(args)

            else:
                response = self.serve_modules("GET") # if the request is handled by a module, do that

                # if nothing from the modules, do a SPARQLGet from securestore
                if response is None:
                    # strip off the model part of the path (i.e., vault support)
                    path = self.path
                    model = "/data/"
                    if path.startswith(model):
                        path = path[len(model)-1:]

                    response = self.proxy.SPARQLGet(path)

            if "type" in response:
                self.send_header("Content-type", response['type'])

            self.send_response(response['status'])
            self.end_headers()

#            self.wfile.write(response['data'])
            return response['data']

    def do_POST(self):
        """Serve a POST request."""

        # TODO native response to a POST
        response = self.serve_modules("POST") # if the request is handled by a module, do that

        if response is None:
            self.send_response(500)
            self.end_headers()
            return ""

        if "type" in response:
            self.send_header("Content-type", response['type'])

        self.send_response(response['status'])
        self.end_headers()
        return response['data']


    def do_PUT(self):
        """Serve a PUT request."""

        response = self.serve_modules("PUT") # if the request is handled by a module, do that

        if response is None:
            # TODO this is where we put the vaults !

            model = self.path[1:] # no vault support yet, so just get rid of the /

            content_type = "application/rdf+xml"
            size = 0

            if self.environment.has_key("CONTENT_LENGTH"):
                size = int(self.environment['CONTENT_LENGTH'])

            if self.environment.has_key("CONTENT_TYPE"):
                content_type = self.environment['CONTENT_TYPE']

            file = ""
            if size > 0:
                # read into file
                file = self.environment['wsgi.input'].read(size)

            # get key
            key = None
            if self.req_qs.has_key('key'):
                key = self.req_qs['key'][0]

            self.proxy.set_key(key)
            response = {"status": self.proxy.SPARQLPut("securestore_default", model, file, content_type), "data": "Successful.\n"}

        if "type" in response:
            self.send_header("Content-type", response['type'])

        self.send_response(response['status'])
        self.end_headers()
#        self.wfile.write(response['data'])
        return response['data']


#    def do_HEAD(self):
#        """Serve a HEAD request."""
#
#        self.send_response(200)
#        self.send_header("Content-type", "text/html")
#        self.send_header("Content-Length", str(fs[6]))
#        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
#        self.end_headers()

#    def setup(self):
#        """ This function means that SSL will work. """
#        self.connection = self.request
#        self.rfile = socket._fileobject(self.request, "rb", self.rbufsize)
#        self.wfile = socket._fileobject(self.request, "wb", self.wbufsize)


    def translate_path(self, path):
        """Translate a /-separated PATH to the local filename syntax.

        Components that mean special things to the local file system
        (e.g. drive or directory names) are ignored.  (XXX They should
        probably be diagnosed.)

        """
        # abandon query parameters
        path = path.split('?',1)[0]
        path = path.split('#',1)[0]
        path = posixpath.normpath(urllib.unquote(path))
        words = path.split('/')
        words = filter(None, words)
#        path = os.getcwd()
        path = self.server.docroot
        for word in words:
            drive, word = os.path.splitdrive(word)
            head, word = os.path.split(word)
            if word in (os.curdir, os.pardir): continue
            path = os.path.join(path, word)
        return path

    def copyfile(self, source):
        """Copy all data between two file objects.

        The SOURCE argument is a file object open for reading
        (or anything with a read() method) and the DESTINATION
        argument is a file object open for writing (or
        anything with a write() method).

        The only reason for overriding this would be to change
        the block size or perhaps to replace newlines by CRLF
        -- note however that this the default server uses this
        to copy binary data as well.

        """
        if source.name.endswith(".html"):
            # treat all *.html files as chameleon templates
            filedata = source.read()
#            template = PageTemplate(filedata)
#            rendered = template.render(**self.template_data)
#            return rendered
            return filedata
        else:
            filedata = source.read()
            return filedata
#            shutil.copyfileobj(source, outputfile)

    def guess_type(self, path):
        """Guess the type of a file.

        Argument is a PATH (a filename).

        Return value is a string of the form type/subtype,
        usable for a MIME Content-type header.

        The default implementation looks the file's extension
        up in the table self.extensions_map, using application/octet-stream
        as a default; however it would be permissible (if
        slow) to look inside the data to make a better guess.

        """

        base, ext = posixpath.splitext(path)
        if ext in self.extensions_map:
            return self.extensions_map[ext]
        ext = ext.lower()
        if ext in self.extensions_map:
            return self.extensions_map[ext]
        else:
            return self.extensions_map['']


    def send_head(self):
        """Common code for GET and HEAD commands.

        This sends the response code and MIME headers.

        Return value is either a file object (which has to be copied
        to the outputfile by the caller unless the command was HEAD,
        and must be closed by the caller under all circumstances), or
        None, in which case the caller has nothing further to do.

        """

        path = self.translate_path(self.path)
        f = None
        if os.path.isdir(path):
            if not self.path.endswith('/'):
                # redirect browser - doing basically what apache does
                self.send_response(301)
                self.send_header("Location", self.path + "/")
                return None
            for index in "index.html", "index.htm":
                index = os.path.join(path, index)
                if os.path.exists(index):
                    path = index
                    break
            else:
                self.send_response(404)
                return None

        ctype = self.guess_type(path)
        try:
            # Always read in binary mode. Opening files in text mode may cause
            # newline translations, making the actual size of the content
            # transmitted *less* than the content-length!
            f = open(path, 'rb')
        except IOError:
            self.send_response(404)
            return None

        self.send_response(200)
        self.send_header("Content-type", ctype)
        fs = os.fstat(f.fileno())
#        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        return f

