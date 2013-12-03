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

import argparse, getpass, logging, nikeplus, pprint, urllib2, sys, json
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred

""" A simple command-line client to demontrate usage of the library. """

logging.basicConfig(level = logging.DEBUG)

parser = argparse.ArgumentParser(description = "Use the Nike+ API")
parser.add_argument('email', type = str, help = "E-mail address of the user in the Nike+ system")
parser.add_argument('user', type=str, help="INDX username, e.g. indx")
parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
parser.add_argument('box', type=str, help="Box to assert data into")
parser.add_argument('--appid', type=str, default="Nike+ Harvester", help="Override the appid used for the INDX assertions")
parser.add_argument('--statusid', type=str, default="nikeplus_status", help="ID of the Status Object in the INDX")
parser.add_argument('--earliest', type=str, default="2013-01-01", help="Earliest date to download in format: 2013-01-20")
parser.add_argument('--debug', default=False, action="store_true", help="Enable debugging")

args = vars(parser.parse_args())
password = getpass.getpass("Nike+ password: ")
indx_password = getpass.getpass("INDX password: ")

if args['debug']:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

def get_indx(server_url, box, user, password, appid):
    return_d = Deferred()
    def authed_cb(): 
        def token_cb(token):
            indx = IndxClient(server_url, box, appid, token = token)
            return_d.callback(indx)

        authclient.get_token(box).addCallbacks(token_cb, return_d.errback)
        
    authclient = IndxClientAuth(server_url, appid)
    authclient.auth_plain(user, password).addCallbacks(lambda response: authed_cb(), return_d.errback)
    return return_d

def indx_cb(indx):

    version = 0 # box version

    def update(data):
        """ Assert data into the INDX.
            If the version is incorrect, the correct version will be grabbed and the update re-sent.

            data -- An object to assert into the box.
        """
        global version
        try:
            response = indx.update(version, data)
            version = response['data']['@version'] # update the version
        except Exception as e:
            if isinstance(e, urllib2.HTTPError) and e.code == 409: # handle a version incorrect error, and update the version
                response = e.read()
                json_response = json.loads(response)
                version = json_response['@version']
                update(data) # try updating again now the version is correct
            else:
                logging.error("Error updating INDX: {0}".format(e))
                sys.exit(0)

    def get_last_date():
        try:
            resp = indx.get_by_ids([args['statusid']])
            data = resp['data']
            val = data[args['statusid']]['last_date'][0]
            return val['@value']
        except Exception as e:
            logging.error("Error reading last date (usually means this is the first time this has been run - not a problem), e: {0}".format(e))
            return args['earliest']

    def set_last_date(last_date):
        data = {"@id": args['statusid'], "last_date": last_date}
        update(data)

    def yesterday():
        from datetime import date, timedelta
        yesterday = date.today() - timedelta(1)
        return yesterday.strftime("%Y-%m-%d")

    last_date = get_last_date()

    nikeplus = nikeplus.NikePlus()
    nikeplus.login(args['email'], password)
    nikeplus.get_token()

    activities = nikeplus.get_activities(last_date, yesterday())
    for activity_container in activities:
        for activity in activity_container:
            activity_id = activity['activityId']
            logging.debug("activity id: {0}".format(activity_id))
            detail = nikeplus.get_activity_detail(activity_id)
            logging.debug("activity_details: {0}".format(pprint.pformat(detail)))
            detail['@id'] = "nikeplus-activity-detail-{0}".format(activity_id)
            update(detail)
        
    set_last_date(yesterday())

get_indx(args['address'], args['box'], args['user'], indx_password, args['appid']).addCallbacks(indx_cb, lambda failure: logging.error("Error: {0}".format(failure)))
