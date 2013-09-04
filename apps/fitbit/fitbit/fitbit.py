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
        baseurl = "https://www.fitbit.com"
        request_url = baseurl + "/oauth/request_token"
        authorize_url = baseurl + "/oauth/authorize"
        callback_url = "http://localhost:8211/apps/fitbit/authorized"
        client = oauth.Client(self.consumer)

        resp, body = client.request(request_url, method="POST")
        if resp['status'] != '200':
            raise Exception("Invalid response getting the request token {0}.".format(resp['status']))
            sys.exit(1)

        self.req_token = dict(urlparse.parse_qsl(body))

        self.logger.info("Successfully got request oauth_token: {0}, oauth_token_secret: {1}".format(self.req_token['oauth_token'], self.req_token['oauth_token_secret']))


        # this interaction needs to be improved, but works for now 
        # print "Go to the following link in your browser:"
        gotourl = "{0}?oauth_token={1}".format(authorize_url, self.req_token['oauth_token'])
        # print gotourl
        return gotourl

    def get_token_with_pin(self, pin):
        baseurl = "https://www.fitbit.com"
        access_url = baseurl + "/oauth/access_token"
        token = oauth.Token(self.req_token['oauth_token'], self.req_token['oauth_token_secret'])
        token.set_verifier(pin)
        client = oauth.Client(self.consumer, token)

        resp, body = client.request(access_url, method="POST")
        if resp['status'] != '200':
            raise Exception("Invalid response getting the access token {0}.".format(resp['status']))
            sys.exit(1)
        auth = dict(urlparse.parse_qsl(body))
        self.token = oauth.Token(auth['oauth_token'], auth['oauth_token_secret'])

        self.logger.info("Successfully got access oauth_token: {0}, oauth_token_secret: {1}".format(auth['oauth_token'], auth['oauth_token_secret']))
        return self.token

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
