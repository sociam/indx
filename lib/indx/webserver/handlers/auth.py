#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
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
from indx.webserver.handlers.base import BaseHandler
import indx.indx_pg2 as database
from twisted.internet.defer import Deferred

import urlparse
import urllib
from openid.store import memstore
#from openid.store import filestore
from openid.consumer import consumer
from openid.oidutil import appendArgs
#from openid.cryptutil import randomString
#from openid.fetchers import setDefaultFetcher, Urllib2Fetcher
from openid.extensions import pape, sreg, ax

from indx.openid import IndxOpenID
from indx.user import IndxUser
from indx.crypto import sha512_hash
from hashing_passwords import make_hash, check_hash

OPENID_PROVIDER_NAME = "INDX OpenID Handler"
OPENID_PROVIDER_URL = "http://indx.ecs.soton.ac.uk/"

class AuthHandler(BaseHandler):
    base_path = 'auth'

    # openid store
    store = memstore.MemoryStore()

    # openid URIs
    AX_URIS = [
        'http://schema.openid.net/contact/email',
        'http://schema.openid.net/namePerson/first',
        'http://schema.openid.net/namePerson/last'
    ]

    # authentication
    def auth_login(self, request):
        """ User logged in (POST) """
        logging.debug('auth login: request, {0}'.format(request));

        user = self.get_arg(request, "username")
        pwd = self.get_arg(request, "password")

        if user is None or pwd is None:
            logging.error("auth_login error, user or pwd is None, returning unauthorized")
            return self.return_unauthorized(request)

        if user[0] == "@":
            # for internal use only
            logging.error("auth_login error, cannot login with users whose names start with '@' using the web interface.")
            return self.return_unauthorized(request)

        def win():
            logging.debug("Login request auth for {0}, origin: {1}".format(user, request.getHeader("Origin")))
            wbSession = self.get_session(request)
            wbSession.setAuthenticated(True)
            wbSession.setUser(user)
            wbSession.setUserType("auth")
            wbSession.setPassword(pwd)
            self.return_ok(request)
        
        def fail():
            logging.debug("Login request fail, origin: {0}".format(self.get_origin(request)))
            wbSession = self.get_session(request)
            wbSession.setAuthenticated(False)
            wbSession.setUser(None)
            wbSession.setUserType(None)
            wbSession.setPassword(None)            
            self.return_unauthorized(request)

        self.database.auth(user,pwd).addCallback(lambda loggedin: win() if loggedin else fail())

    def auth_keys(self, request):
        """ Log in using pre-shared keys. (POST) """
        logging.debug('auth_keys, request: {0}'.format(request));

        def fail():
            logging.debug("Login request fail, origin: {0}".format(self.get_origin(request)))
            wbSession = self.get_session(request)
            wbSession.setAuthenticated(False)
            wbSession.setUser(None)
            wbSession.setUserType(None)
            wbSession.setPassword(None)            
            self.return_unauthorized(request)

        SSH_MSG_USERAUTH_REQUEST = "50"

        key_signature = self.get_arg(request, "key_signature")
        key = self.get_arg(request, "key")
        algo = self.get_arg(request, "algo")
        method = self.get_arg(request, "method")

        if key_signature is None or key is None or algo is None or method is None:
            logging.error("auth_keys error, key_signature, key, algo or method is None, returning unauthorized")
            return fail()

        key_hash = sha512_hash(key)

        keypair = self.webserver.keystore(key_hash)

        sessionid = request.getSession().uid

        ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, sessionid, method, algo, key)
        signature = self.rsa_encrypt(key, ordered_signature_text)
        
        if signature != key_signature:
            logging.error("auth_keys error, key_signature does not match signature, returning unauthorized")
            return fail()
        
        logging.debug("Login request auth for {0}, origin: {1}".format(user, request.getHeader("Origin")))
        wbSession = self.get_session(request)
        wbSession.setAuthenticated(True)
        wbSession.setUser(user)
        wbSession.setUserType("auth")
        wbSession.setPassword(pwd)
        self.return_ok(request)


    def auth_logout(self, request):
        """ User logged out (GET, POST) """
        logging.debug("Logout request, origin: {0}".format(self.get_origin(request)))
        wbSession = self.get_session(request)
        wbSession.setAuthenticated(False)
        wbSession.setUser(None)
        wbSession.setUserType(None)
        wbSession.setPassword(None)        
        self.return_ok(request)

    def auth_whoami(self, request):
        wbSession = self.get_session(request)
        logging.debug('auth whoami ' + repr(wbSession))

        user = IndxUser(self.database, wbSession.username)

        def info_cb(user_info):
            if user_info is None:
                user_info = {}

            # add our username and is_authenticated information
            if 'username' not in user_info: 
                user_info['username'] = wbSession and wbSession.username or 'nobody'

            user_info['is_authenticated'] = wbSession and wbSession.is_authenticated
            self.return_ok(request, user_info)

        # don't decode the user_metadata string, leave as a json string
        user.get_user_info(decode_json = False).addCallbacks(info_cb, lambda failure: self.return_internal_error(request))

        
    def get_token(self,request):
        ## 1. request contains appid & box being requested (?!)
        ## 2. check session is Authenticated, get username/password

        appid = self.get_arg(request, "app")
        boxid = self.get_arg(request, "box")

        if appid is None or boxid is None:
            logging.error("get_token error, appid or boxid is None, returning bad request.")
            return self.return_bad_request(request)

        wbSession = self.get_session(request)
        if not wbSession.is_authenticated:
            return self.return_unauthorized(request)

        username = wbSession.username
        password = wbSession.password
        origin = self.get_origin(request)

        def got_acct(acct):
            if acct == False:
                return self.return_forbidden(request)

            db_user, db_pass = acct

            def check_app_perms(acct):
                token = self.webserver.tokens.new(username,password,boxid,appid,origin,request.getClientIP())
                return self.return_ok(request, {"token":token.id})

            # create a connection pool
            database.connect_box(boxid,db_user,db_pass).addCallbacks(check_app_perms, lambda conn: self.return_forbidden(request))

        self.database.lookup_best_acct(boxid, username, password).addCallbacks(got_acct, lambda conn: self.return_forbidden(request))

    ### OpenID functions

    def login_openid(self, request):
        """ Verify an OpenID identity. """
        wbSession = self.get_session(request)

        identity = self.get_arg(request, "identity")

        if identity is None:
            logging.error("login_openid error, identity is None, returning bad request.")
            return self.return_bad_request(request, "You must specify an 'identity' in the GET/POST query parameters.")

        redirect = self.get_arg(request, "redirect")
        wbSession.set_openid_redirect(redirect)

        if redirect is None:
            logging.error("login_openid error, redirect is None, returning bad request.")
            return self.return_bad_request(request, "You must specify a 'redirect' in the GET/POST query parameters.")


        def post_user_info(request_user_metadata):
            logging.debug("login_openid post_user_info, request_user_metadata: {0}".format(request_user_metadata))

            oid_consumer = consumer.Consumer(self.get_openid_session(request), self.store)
            try:
                oid_req = oid_consumer.begin(identity)
                if request_user_metadata:                    
                    # SReg speaks this protocol: http://openid.net/specs/openid-simple-registration-extension-1_1-01.html
                    # and tries to request additional metadata about this OpenID identity
                    sreg_req = sreg.SRegRequest(required=['fullname','nickname','email'], optional=[])
                    oid_req.addExtension(sreg_req)

                    # AX speaks this protocol: http://openid.net/specs/openid-attribute-exchange-1_0.html
                    # and tries to get more attributes (by URI), we request some of the more common ones
                    ax_req = ax.FetchRequest()
                    for uri in self.AX_URIS:
                        ax_req.add(ax.AttrInfo(uri, required = True))
                    oid_req.addExtension(ax_req)
            except consumer.DiscoveryFailure as exc:
                logging.error("Error in login_openid: {0}".format(exc))
                self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
                return
            else:
                if oid_req is None:
                    logging.error("Error in login_openid: no OpenID services found for: {0}".format(identity))
                    self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
                    return
                else:
                    trust_root = self.webserver.server_url
                    return_to = appendArgs(trust_root + "/" + self.base_path + "/openid_process", {})

                    logging.debug("OpenID, had oid_req, trust_root: {0}, return_to: {1}, oid_req: {2}".format(trust_root, return_to, oid_req))

                    redirect_url = oid_req.redirectURL(trust_root, return_to)
                    request.setHeader("Location", redirect_url)
                    request.setResponseCode(302, "Found")
                    request.finish()
                    return

        user = IndxUser(self.database, identity)
        user.get_user_info().addCallbacks(lambda user_info: post_user_info(user_info is None), lambda failure: self.return_internal_error(request))
        # if user_info is None, then request_user_metadata = True
        return

    def _url_add_params(self, url, params):

        url_parts = list(urlparse.urlparse(url))
        query = dict(urlparse.parse_qsl(url_parts[4]))
        query.update(params)

        url_parts[4] = urllib.urlencode(query)

        return urlparse.urlunparse(url_parts)

    def openid_process(self, request):
        """ Process a callback from an identity provider. """
        oid_consumer = consumer.Consumer(self.get_openid_session(request), self.store)
        query = urlparse.parse_qsl(urlparse.urlparse(request.uri).query)
        queries = {}
        for key, val in query:
            queries[key] = val.decode('UTF-8')
        logging.debug("Queries: {0}".format(queries))
        info = oid_consumer.complete(queries, self.webserver.server_url + "/" + self.base_path + "/openid_process")

        display_identifier = info.getDisplayIdentifier()

        if info.status == consumer.FAILURE and display_identifier:
            logging.error("Verification of {0} failed: {1}".format(display_identifier, info.message))
            self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
            return
        elif info.status == consumer.SUCCESS:
            sreg_resp = sreg.SRegResponse.fromSuccessResponse(info)
            sreg_data = {}
            if sreg_resp is not None:
                sreg_data = sreg_resp.data
            pape_resp = pape.Response.fromSuccessResponse(info)
            ax_resp = ax.FetchResponse.fromSuccessResponse(info)
            ax_data = {}
            if ax_resp is not None:
                for uri in self.AX_URIS:
                    ax_data[uri] = ax_resp.get(uri)

            logging.debug("openid_process: Success of {0}, sreg_resp: {1} (sreg_data: {2}), pape_resp: {3}, ax_resp: {4}, ax_data: {5}".format(display_identifier, sreg_resp, sreg_data, pape_resp, ax_resp, ax_data))

            if len(ax_data.keys()) > 0:
                user_metadata = {
                    "name": ax_data['http://schema.openid.net/namePerson/first'][0] + " " + ax_data['http://schema.openid.net/namePerson/last'][0],
                    "email": ax_data['http://schema.openid.net/contact/email'][0],
                }
            elif len(sreg_data.keys()) > 0:
                user_metadata = {
                    "name": sreg_data['fullname'],
                    "nickname": sreg_data['nickname'],
                    "email": sreg_data['email'],
                }
            else:
                user_metadata = {}

            if info.endpoint.canonicalID:
                logging.debug("openid_process, additional: ...This is an i-name and its persistent ID is: {0}".format(info.endpoint.canonicalID))

            # Success - User is now INDX authenticated - they can request a token now.
            wbSession = self.get_session(request)
            wbSession.setAuthenticated(True)
            wbSession.setUserType("openid") # TODO FIXME standardise
            wbSession.setUser(display_identifier) # namespace this as a openid or something?
            wbSession.setPassword("") # XXX

            # Initialise the OpenID user now:
            ix_openid = IndxOpenID(self.database, display_identifier)

            def err_cb(err):
                logging.error("Error in IndxOpenID: {0}".format(err))
                self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
                return

            def cb(user_info):
                user_info['status'] = 200
                user_info['message'] = "OK"
                self._send_openid_redirect(request, user_info)
                return
    
            ix_openid.init_user(user_metadata).addCallbacks(cb, err_cb)
            return
        elif info.status == consumer.CANCEL:
            logging.error("Error in openid_process: Verification cancelled.")
            self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
            return
        elif info.status == consumer.SETUP_NEEDED:
            logging.error("Error in openid_process: Setup needed at URL: {0}".format(info.setup_url))
            self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
            return
        else:
            logging.error("Error in openid_process: Verification Failed.")
            self._send_openid_redirect(request, {"status": 401, "message": "Unauthorized"})
            return


    def _send_openid_redirect(self, request, continuation_params):
        """ OpenID has finished, send a redirect with the specified parameters. """
        logging.debug("Auth: sending openid redirect with continuation params: {0}".format(continuation_params))

        wbSession = self.get_session(request)
        redirect_url = wbSession.get_openid_redirect()

        continuation_params['username_type'] = "openid"

        request.setHeader("Location", self._url_add_params(redirect_url, continuation_params))
        request.setResponseCode(302, "Found")
        request.finish()


    def get_openid_session(self, request):
        return self.get_session(request).get_openid_session()


AuthHandler.subhandlers = [
    {
        'prefix':'whoami',
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.auth_whoami,
        'content-type':'text/plain', # optional
        'accept':['application/json']      
    },    
    {
        'prefix':'login',
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.auth_login,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
    {
        'prefix':'login_keys',
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.auth_keys,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
    {
        # for a google plus account
        # http://localhost:8211/auth/login_openid?identity=https://plus.google.com/114976418317566143717
        # for an INDX ID account
        # http://localhost:8211/auth/login_openid?identity=http://id.indx.ecs.soton.ac.uk/identity/ds
        'prefix':'login_openid', # login with openid
        'methods': ['POST','GET'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.login_openid,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
    {
        'prefix':'openid_process', # callback from the remote system with a success/fail, to the local browser
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.openid_process,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
    {
        'prefix':'logout',
        'methods': ['POST', 'GET'],
        'require_auth': True,
        'require_token': False,
        'handler': AuthHandler.auth_logout,
        'content-type':'text/plain', # optional
        'accept':['application/json']        
    },
    {
        'prefix':'get_token',
        'methods': ['POST'],
        'require_auth': True,
        'require_token': False,
        'handler': AuthHandler.get_token,
        'content-type':'application/json', 
        'accept':['application/json']                
    },
    {
        'prefix':'logout',
        'methods': ['POST', 'GET'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.return_ok, # already logged out
        'content-type':'text/plain', # optional
        'accept':['application/json']                
        },
     {
        'prefix':'*',
        'methods': ['OPTIONS'],
        'require_auth': False,
        'require_token': False,
        'handler': AuthHandler.return_ok, # already logged out
        'content-type':'text/plain', # optional
        'accept':['application/json']                
     }    
]


