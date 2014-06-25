import json, urllib, urllib2, urlparse, logging, cookielib, pprint
import oauth2 as oauth

# TODO add an accept-language header to set the measurement units to us or metric
class Fitbit:

    def __init__(self, consumer_key, consumer_secret, access_token_key=None, access_token_secret=None):
        self.logger = logging.getLogger("fitbit")

        self.api_base_url = "http://api.fitbit.com"

        self.consumer = oauth.Consumer(consumer_key, consumer_secret)

        self.token = None
        if (access_token_key !=None and access_token_secret !=None):
            self.token = oauth.Token(access_token_key, access_token_secret)

    def get_token_url(self):
        request_url = "{0}/oauth/request_token".format(self.api_base_url)
        authorize_url = "{0}/oauth/authorize".format(self.api_base_url)
        req = oauth.Request.from_consumer_and_token(consumer=self.consumer, http_method="POST", http_url=request_url)
        sig_method = oauth.SignatureMethod_HMAC_SHA1()
        req.sign_request(sig_method, self.consumer, self.token)
        headers = req.to_header()

        request = urllib2.Request(request_url, data=None, headers=headers)
        request.get_method = lambda: "POST"
        # req.add_header('Authorization', headers['Authorization'])
        resp = urllib2.urlopen(request)
        if resp.getcode() != 200:
            raise Exception("Invalid response {0} getting the request token {1} {2}.".format(resp.getcode(), resp.read(), resp.info()))
            sys.exit(1)
        data = resp.read()
        self.req_token = dict(urlparse.parse_qsl(data))
        self.logger.info("Successfully got request oauth_token: {0}, oauth_token_secret: {1}".format(self.req_token['oauth_token'], self.req_token['oauth_token_secret']))
        gotourl = "{0}?oauth_token={1}".format(authorize_url, self.req_token['oauth_token'])
        return {"url":gotourl, "req_token":self.req_token}

    def get_token_with_pin(self, pin, req_token):
        request_url = "{0}/oauth/access_token".format(self.api_base_url)
        token = oauth.Token(req_token['oauth_token'], req_token['oauth_token_secret'])
        token.set_verifier(pin)

        req = oauth.Request.from_consumer_and_token(consumer=self.consumer, token=token, http_method="POST", http_url=request_url)
        sig_method = oauth.SignatureMethod_HMAC_SHA1()
        req.sign_request(sig_method, self.consumer, token)
        headers = req.to_header()

        request = urllib2.Request(request_url, data=None, headers=headers)
        request.get_method = lambda: "POST"
        resp = urllib2.urlopen(request)
        if resp.getcode() != 200:
            raise Exception("Invalid response {0} getting the access token {1} {2}.".format(resp.getcode(), resp.read(), resp.info()))
            return None
        data = resp.read()
        auth = dict(urlparse.parse_qsl(data))
        self.token = oauth.Token(auth['oauth_token'], auth['oauth_token_secret'])
        self.logger.info("Successfully got access oauth_token: {0}, oauth_token_secret: {1}".format(auth['oauth_token'], auth['oauth_token_secret']))
        return auth

    def call_get_api(self, url):
        full_url = "{0}{1}".format(self.api_base_url, url)
        req = oauth.Request.from_consumer_and_token(consumer=self.consumer, token=self.token, http_method="GET", http_url=full_url)
        sig_method = oauth.SignatureMethod_HMAC_SHA1()
        req.sign_request(sig_method, self.consumer, self.token)
        headers = req.to_header()

        req = urllib2.Request(full_url)
        req.get_method = lambda: "GET"
        req.add_header('Authorization', headers['Authorization'])
        resp = urllib2.urlopen(req)
        data = resp.read()
        return data

    def set_token(self, token):
        if token is not None:
            self.token = oauth.Token(token['oauth_token'], token['oauth_token_secret'])

    def get_token(self):
        return self.token
