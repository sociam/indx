#    This file is part of python-nikeplus-2013.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
#
#    python-nikeplus-2013 is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    python-nikeplus-2013 is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with python-nikeplus-2013.  If not, see <http://www.gnu.org/licenses/>.

import json, urllib, urllib2, logging, cookielib, time, pprint, datetime

""" Access and get data from the nikeplus system (using the 2013 API). """
class NikePlus:

    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Host": "developer.nike.com",
        "Origin": "https://developer.nike.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31",
        "Accept": "*/*",
        "Accept-Charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
        "Accept-Language": "en-GB,en-US;q=0.8,en;q=0.6",
    }
    
    def __init__(self):
        """ Set up the logger in a new channel. """
        self.logger = logging.getLogger("python-nikeplus-2013")

        """ Set up a cookies-enabled opener locally. """
        cj = cookielib.LWPCookieJar()
        self.opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cj))

    def login(self, email, password):
        """ Login to the developer area to get the authentication cookie. """

        self.email = email
        self.password = password

        url = "https://developer.nike.com/login"

        body = urllib.urlencode({"continue_url": "/categories", "email": self.email, "password": self.password})
        req = urllib2.Request(url, body, self.headers)
        req.get_method = lambda: "POST"
        self.opener.open(req)
        time.sleep(1)
        # Result is that we have a logged-in cookie in our jar now.

    def get_token(self):
        """ Get a API token using a user's credentials and store it in this object. """

        url = "https://developer.nike.com/request/"

        """ API call accepts a urlencoded string with a single key "data" and a JSON string as the value, as the body of the POST request. """
        body = "data=%7B%22method%22%3A%22POST%22%2C%22url%22%3A%22%25base_url%25%2Fnsl%2Fv2.0%2Fuser%2Flogin%3Fformat%3Djson%26app%3D%2525appid%2525%26client_id%3D%2525client_id%2525%26client_secret%3D%2525client_secret%2525%22%2C%22headers%22%3A%7B%22appid%22%3A%22%25appid%25%22%2C%22Accept%22%3A%22application%2Fjson%22%2C%22Content-Type%22%3A%22application%2Fx-www-form-urlencoded%22%7D%2C%22body%22%3A%22email%3D{0}%26password%3D{1}%22%7D".format(urllib.quote(self.email), urllib.quote(self.password))

        """ Make the HTTP request. """
        req = urllib2.Request(url, body, self.headers)
        req.get_method = lambda: "POST"
        f = self.opener.open(req)
        resp = f.read()
        time.sleep(1)

        response = json.loads(resp)
        self.logger.debug("get_token: received response: {0}".format(response))
        
        body = json.loads(response['body']) # double JSON encoded. seriously.
        self.logger.debug("get_token: received response body: {0}".format(body))

        if 'access_token' in body:
            token = body['access_token']
            expires_in = body['expires_in']
        
            self.logger.debug("Successfully got token: {0}, expires in: {1}".format(token, expires_in))
            self.token = token
            self.user = body["User"]
            return token
        elif 'serviceResponse' in body:
            header = body['serviceResponse']['header']
            self.logger.debug("get_token: received response header: {0}".format(header))
            if header["success"] == 'false':
                raise LoginError(header["errorCodes"])
        else:
            self.logger("Couldn't get token.")

    def get_activities(self, start_date, end_date, offset = 1):
        """ Get the list of activity IDs for this user. """
        start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")

        url = "https://developer.nike.com/request/"
        count = 1

        data = []
        for n in range(int((end_date - start_date).days + 1)):
            this_datetime = start_date + datetime.timedelta(n)
            this_date = this_datetime.strftime("%Y-%m-%d")

            body = "data=%7B%22method%22%3A%22GET%22%2C%22url%22%3A%22https%3A%2F%2Fapi.nike.com%2Fme%2Fsport%2Factivities%3Faccess_token%3D{0}%26offset%3D{1}%26count%3D{2}%26startDate%3D{3}%26endDate%3D{4}%22%2C%22headers%22%3A%7B%22appid%22%3A%22%25appid%25%22%2C%22Accept%22%3A%22application%2Fjson%22%7D%2C%22body%22%3A%22%22%2C%22environment%22%3A%22prod%22%7D".format(self.token, offset, count, this_date, this_date)

            req = urllib2.Request(url, body)
            req.get_method = lambda: "POST"
            f = self.opener.open(req)
            resp = f.read()
            time.sleep(1)
            self.logger.debug("get_activities: received resp: {0}".format(pprint.pformat(resp)))
            
            response = json.loads(resp)
            self.logger.debug("get_activities: received response: {0}".format(pprint.pformat(response)))

            body = json.loads(response['body']) # double JSON encoded. seriously.
            self.logger.debug("get_activities: received response body: {0}".format(pprint.pformat(body)))

            data.append(body['data'])

        return data

    def get_activity_detail(self, activity_id):
        """ Get detailed data on a specific activity, based on its ID. """

        url = "https://developer.nike.com/request/"

        body = "data=%7B%22method%22%3A%22GET%22%2C%22url%22%3A%22https%3A%2F%2Fapi.nike.com%2Fme%2Fsport%2Factivities%2F{1}%3Faccess_token%3D{0}%26activityId%3D{1}%22%2C%22headers%22%3A%7B%22appid%22%3A%22%25appid%25%22%2C%22Accept%22%3A%22application%2Fjson%22%7D%2C%22body%22%3A%22%22%2C%22environment%22%3A%22prod%22%7D".format(self.token, activity_id)

        req = urllib2.Request(url, body)
        req.get_method = lambda: "POST"
        f = self.opener.open(req)
        resp = f.read()
        time.sleep(1)
        self.logger.debug("get_activities: received resp: {0}".format(pprint.pformat(resp)))
        
        response = json.loads(resp)
        self.logger.debug("get_activities: received response: {0}".format(pprint.pformat(response)))

        body = json.loads(response['body']) # double JSON encoded. seriously.
        self.logger.debug("get_activities: received response body: {0}".format(pprint.pformat(body)))

        return body


    def get_gps_data(self, activity_id):
        """ Get GPS data on a specific activity, based on its ID. """

        url = "https://developer.nike.com/request/"

        body = "data=%7B%22method%22%3A%22GET%22%2C%22url%22%3A%22https%3A%2F%2Fapi.nike.com%2Fme%2Fsport%2Factivities%2F{1}%2Fgps%3Faccess_token%3D{0}%26activityId%3D{1}%22%2C%22headers%22%3A%7B%22appid%22%3A%22%25appid%25%22%2C%22Accept%22%3A%22application%2Fjson%22%7D%2C%22body%22%3A%22%22%2C%22environment%22%3A%22prod%22%7D".format(self.token, activity_id)

        req = urllib2.Request(url, body)
        req.get_method = lambda: "POST"
        f = self.opener.open(req)
        resp = f.read()
        time.sleep(1)
        self.logger.debug("get_activities: received resp: {0}".format(pprint.pformat(resp)))
        
        response = json.loads(resp)
        self.logger.debug("get_activities: received response: {0}".format(pprint.pformat(response)))

        body = json.loads(response['body']) # double JSON encoded. seriously.
        self.logger.debug("get_activities: received response body: {0}".format(pprint.pformat(body)))

        return body

class LoginError(Exception):
    def __init__(self, error):
        self.error = error
    def __str__(self):
        return str(self.error[0]['message'])