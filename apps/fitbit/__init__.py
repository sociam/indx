import logging, json
from indx.webserver.handlers.base import BaseHandler
import requests
from twisted.web.server import NOT_DONE_YET
from fitbit import Fitbit, FitbitIntraDay
from pyindx import IndxClient
from datetime import datetime, date, time, timedelta

class FitbitApp(BaseHandler):

    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.isLeaf = True
        self.consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
        self.consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"
        self.fitbit = Fitbit(self.consumer_key, self.consumer_secret)

    def render(self, request):
        logging.info("Fitbit App, request args: {0}".format(request.args))
        # if "init" in request.args:
        #     self.indx = IndxClient("http://{0}".format(request.args['host'][0]), request.args['box'], request.args['username'], request.args["password"], "FitbitConnector")
        #     print self.indx
        #     logging.info("Fitbit App, connected to the box {0}".format(box))
        #     self.return_ok(request, data = {"init": "ok"})
        if "gotourl" in request.args:
            gotourl = self.fitbit.get_token_url()
            logging.info("Fitbit App, the gotourl is {0}".format(gotourl))
            self.return_ok(request, data = {"url": gotourl})
        elif "pin" in request.args:
            pin = request.args['pin'][0]
            logging.info("Fitbit App, the pin is {0}".format(pin))
            token = self.fitbit.get_token_with_pin(pin)
            self.return_ok(request, data = {"token": json.dumps({"token_key": "{0}".format(token.key), "token_secret": "{0}".format(token.secret)})})
        elif "token" in request.args:
            token = json.loads(request.args["token"][0])
            self.fitbit = Fitbit(self.consumer_key, self.consumer_secret, token['token_key'], token['token_secret'])
            self.return_ok(request, data={})
        elif "download" in request.args:
            self.fitbit_min = FitbitIntraDay(self.fitbit)
            start = None
            if ("start" in request.args):
                start = datetime.fromtimestamp(int(request.args["start"][0])/1000)
            response = self.download_data(start)
            self.return_ok(request, data = response)
        else:
            logging.info("Fitbit App, returning 404")
            self.return_not_found(request)
        return NOT_DONE_YET

    def download_data(self, start):
        # end time is end of yesterday 
        end = datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(23,59,59))
        response = {}
        if (start == None):
            d = timedelta(days=0)
            start = datetime.combine(end.date()+d, time(0,0,0))
            response["from_date"] = start.isoformat()

        steps = self.fitbit_min.get_steps(start, end)
        calories = self.fitbit_min.get_calories(start, end)
        distance = self.fitbit_min.get_distance(start, end)
        floors = self.fitbit_min.get_floors(start, end)
        elevation = self.fitbit_min.get_elevation(start, end)

        compact_steps = self.compact_data(steps)
        compact_calories = self.compact_data(calories)
        compact_distance = self.compact_data(distance)
        compact_floors = self.compact_data(floors)
        compact_elevation = self.compact_data(elevation)
        
        observations = self.create_observation_points({"step_count":compact_steps, "calories_burned": compact_calories, "distance": compact_distance, "floors_climbed": compact_floors, "elevation": compact_elevation})
        response["up_to_date"] = end.isoformat()
        response["observations"] = "{0}".format(json.dumps(observations))
        return response

    def compact_data(self, observations):
        out = {}
        for day_data in observations:
            out = dict(out.items() + self.compact_day_data(day_data).items())
        return out

    def compact_day_data(self, observations):
        out = {}
        day = None
        for key in observations.keys():
            if (not key.endswith('-intraday')):
                day = datetime.strptime(observations[key][0]["dateTime"], "%Y-%m-%d").date()
        for key in observations.keys():
            if (key.endswith('-intraday')):
                for obs in observations[key]["dataset"]:
                    if (obs["value"] != 0):
                        t = datetime.strptime(obs["time"], "%H:%M:%S").time()
                        out[datetime.combine(day, t)] = obs["value"]
        return out

    def create_observation_points(self, lists):
        data_points = {}
        for key in lists.keys():
            lst = lists[key]
            for d in lst.keys():
                if (d in data_points):
                    data_points[d] = dict(data_points[d].items() + {key: lst[d]}.items())
                else:
                    data_points[d] = {key: lst[d]}
        observations = []
        for data_point in data_points.items():
            obs = self.create_observation_point(data_point[0], data_point[1])
            observations.append(obs)
        return observations

    def create_observation_point(self, ts, data):
        obs = {}
        # obs['@id'] = 'fitbit_{0}'.format(ts.strftime('%Y_%m_%d_%H_%M')) # put the id and type in the js code to transfer less data
        # obs['@type'] = 'http://purl.org/linked-data/cube#Observation' 
        obs['start'] = ts.isoformat()
        obs['end'] = (ts+timedelta(seconds=59)).isoformat()
        # obs['device'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#string', '@value': 'Fitbit Connector' } ] # put the device in the js code to transfer less data
        for key in data.keys():
            obs[key] = '{0}'.format(data[key])
        return obs

APP = FitbitApp
