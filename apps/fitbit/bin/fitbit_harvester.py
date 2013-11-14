import logging, json, argparse, sys, time, os, requests, urllib
import logging.config
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from fitbit import Fitbit, FitbitIntraDay
from indxclient import IndxClient
import oauth2 as oauth

class FitbitHarvester:

    def __init__(self):
        logging.basicConfig(filename="fitbit_harvester.log", level=logging.DEBUG)
    
        data_root = keyring.util.platform_.data_root()
        if not os.path.exists(data_root):
            os.mkdir(data_root)
        keyring.set_keyring(PlaintextKeyring())

        self.parser = argparse.ArgumentParser(prog="run")
        self.parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
        self.parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")

        # init fitbit
        consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
        consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"
        self.fitbit = Fitbit(consumer_key, consumer_secret)

    def set_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        if stored_config_harvester is not None:
            stored_config_harvester = json.loads(stored_config_harvester)
        stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")
        if stored_config_fitbit is not None:
            stored_config_fitbit = json.loads(stored_config_fitbit)

        received_config = json.loads(args['config'])
        if (type(received_config) != dict):
            received_config = json.loads(received_config)
        logging.debug("Received config: {0}".format(received_config))
        config = {}
        if 'fitbit' in received_config:
            fitbit_config = received_config['fitbit']
            if fitbit_config and ('pin' in fitbit_config) and ('req_token' in fitbit_config): # this should check for the req_token in the stored config!
                logging.debug("Received pin: {0}".format(fitbit_config['pin']))
                try:
                    token = self.fitbit.get_token_with_pin(fitbit_config['pin'], fitbit_config['req_token'])
                    logging.debug("Got auth token {0}".format(token))
                    logging.debug("Got auth token of type {0}".format(type(token)))
                    if token:
                        config['token']=token
                        keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config))
                except Exception as exc:
                    logging.error("Could not authorise to fitbit, with pin {0}, error: {1}".format(fitbit_config['pin'], exc))
        if 'harvester' in received_config:
            harvester_config = received_config['harvester']
            if harvester_config != stored_config_harvester:
                keyring.set_password("INDX", "INDX_Fitbit_Harvester", json.dumps(harvester_config)) 

    def get_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")

        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        logging.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

        if stored_config_fitbit is None :
            token_url = self.fitbit.get_token_url()
            config_fitbit = {}
            config_fitbit["url"] = token_url['url']
            config_fitbit["req_token"] = token_url['req_token']
        else :
            if (type(stored_config_fitbit) != dict):
                config_fitbit = json.loads(stored_config_fitbit)
            if (type(config_fitbit) != dict):
                config_fitbit = json.loads(config_fitbit)
            if 'token' not in config_fitbit :
                token_url = self.fitbit.get_token_url()
                config_fitbit["url"] = token_url['url']
                config_fitbit["req_token"] = token_url['req_token']
                keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config_fitbit))
        if stored_config_harvester is None:
            return json.dumps({"fitbit":config_fitbit}) # don't send the req_token
        return json.dumps({"fitbit":config_fitbit, "harvester":json.loads(stored_config_harvester)}) # don't send the req_token


    def check_configuration(self):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        logging.debug("stored_config_harvester type: {0}".format(type(stored_config_harvester)))
        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        if stored_config_harvester is None :
            logging.error("Harvester not configured. Please configure before use.")
            exit(1)

        if self.fitbit.get_token() is None:
            stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")
            logging.debug("stored_config_fitbit type: {0}".format(type(stored_config_fitbit)))
            logging.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

            token = None
            if stored_config_fitbit is None :
                logging.error("Not authenticated to Fitbit.com. Please configure before use.")
                exit(1)
            else :
                if (type(stored_config_fitbit) != dict):
                    stored_config_fitbit = json.loads(stored_config_fitbit)
                    logging.debug("stored_config_fitbit type (after 1 loads): {0}".format(type(stored_config_fitbit)))
                if 'token' not in stored_config_fitbit :
                    logging.debug("Could not find Fitbit auth token in keyring");
                    if ('pin' in stored_config_fitbit) and ('req_token' in stored_config_fitbit):
                        logging.debug("Found pin {0} and req_token in keyring, attempting authorization to Fitbit.com".format(stored_config_fitbit['pin']))
                        try:
                            fitbit_token_config = {}
                            token = self.fitbit.get_token_with_pin(stored_fitbit_config['pin'], stored_fitbit_config['req_token'])
                            if token:
                                logging.debug("Got auth token {0}".format(token))
                                # logging.debug("Got auth token of type {0}".format(type(token)))
                                fitbit_token_config['token']=token
                            keyring.set_password("Fitbit.com", "Fitbit", json.dumps(fitbit_token_config))
                        except Exception as exc:
                            logging.error("Could not authorise to fitbit, error: {1}".format(exc))
                            exit(1)
                    else :
                        logging.debug("Could not find pin or req_token in keyring. Cannot attempt authorization to Fitbit.com."))
                        exit(1)
                else: 
                    token = stored_config_fitbit['token']
            if token is not None :
                self.fitbit.set_token(token)
        return stored_config_harvester['start'], stored_config_harvester['frequency'], stored_config_harvester['box'], stored_config_harvester['user']


    def harvest(self):
        start, freq, box, user = check_configuration()
        download_data(start)


    def run(self):
        args = vars(self.parser.parse_args())
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            logging.debug("Starting the harvester. ")
            harvest()

    # keyring.set_password("INDX", "INDX_Blank_App", "{'password':'asdf', 'user':'laura', 'box':'blankie'}")
    # print keyring.get_password("INDX", "INDX_Blank_App")

if __name__ == '__main__':
    harvester = FitbitHarvester()
    harvester.run();


#     def render(self, request):
#         logging.info("Fitbit App, request args: {0}".format(request.args))
#         # if "init" in request.args:
#         #     self.indx = IndxClient("http://{0}".format(request.args['host'][0]), request.args['box'], request.args['username'], request.args["password"], "FitbitConnector")
#         #     print self.indx
#         #     logging.info("Fitbit App, connected to the box {0}".format(box))
#         #     self.return_ok(request, data = {"init": "ok"})
#         if "gotourl" in request.args:
#             gotourl = self.fitbit.get_token_url()
#             logging.info("Fitbit App, the gotourl is {0}".format(gotourl))
#             self.return_ok(request, data = {"url": gotourl})
#         elif "pin" in request.args:
#             pin = request.args['pin'][0]
#             logging.info("Fitbit App, the pin is {0}".format(pin))
#             token = self.fitbit.get_token_with_pin(pin)
#             self.return_ok(request, data = {"token": json.dumps({"token_key": "{0}".format(token.key), "token_secret": "{0}".format(token.secret)})})
#         elif "token" in request.args:
#             token = json.loads(request.args["token"][0])
#             self.fitbit = Fitbit(self.consumer_key, self.consumer_secret, token['token_key'], token['token_secret'])
#             self.return_ok(request, data={})
#         elif "download" in request.args:
#             self.fitbit_min = FitbitIntraDay(self.fitbit)
#             start = None
#             if ("start" in request.args):
#                 start = datetime.fromtimestamp(int(request.args["start"][0])/1000)
#             response = self.download_data(start)
#             self.return_ok(request, data = response)
#         else:
#             logging.info("Fitbit App, returning 404")
#             self.return_not_found(request)
#         return NOT_DONE_YET

    def download_data(self, start):
        

#         end = datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(23,59,59))
#         response = {}
#         if (start == None):
#             d = timedelta(days=0)
#             start = datetime.combine(end.date()+d, time(0,0,0))
#             response["from_date"] = start.isoformat()

#         steps = self.fitbit_min.get_steps(start, end)
#         calories = self.fitbit_min.get_calories(start, end)
#         distance = self.fitbit_min.get_distance(start, end)
#         floors = self.fitbit_min.get_floors(start, end)
#         elevation = self.fitbit_min.get_elevation(start, end)

#         compact_steps = self.compact_data(steps)
#         compact_calories = self.compact_data(calories)
#         compact_distance = self.compact_data(distance)
#         compact_floors = self.compact_data(floors)
#         compact_elevation = self.compact_data(elevation)
        
#         observations = self.create_observation_points({"step_count":compact_steps, "calories_burned": compact_calories, "distance": compact_distance, "floors_climbed": compact_floors, "elevation": compact_elevation})
#         response["up_to_date"] = end.isoformat()
#         response["observations"] = "{0}".format(json.dumps(observations))
#         return response

#     def compact_data(self, observations):
#         out = {}
#         for day_data in observations:
#             out = dict(out.items() + self.compact_day_data(day_data).items())
#         return out

#     def compact_day_data(self, observations):
#         out = {}
#         day = None
#         for key in observations.keys():
#             if (not key.endswith('-intraday')):
#                 day = datetime.strptime(observations[key][0]["dateTime"], "%Y-%m-%d").date()
#         for key in observations.keys():
#             if (key.endswith('-intraday')):
#                 for obs in observations[key]["dataset"]:
#                     if (obs["value"] != 0):
#                         t = datetime.strptime(obs["time"], "%H:%M:%S").time()
#                         out[datetime.combine(day, t)] = obs["value"]
#         return out

#     def create_observation_points(self, lists):
#         data_points = {}
#         for key in lists.keys():
#             lst = lists[key]
#             for d in lst.keys():
#                 if (d in data_points):
#                     data_points[d] = dict(data_points[d].items() + {key: lst[d]}.items())
#                 else:
#                     data_points[d] = {key: lst[d]}
#         observations = []
#         for data_point in data_points.items():
#             obs = self.create_observation_point(data_point[0], data_point[1])
#             observations.append(obs)
#         return observations

#     def create_observation_point(self, ts, data):
#         obs = {}
#         # obs['@id'] = 'fitbit_{0}'.format(ts.strftime('%Y_%m_%d_%H_%M')) # put the id and type in the js code to transfer less data
#         # obs['@type'] = 'http://purl.org/linked-data/cube#Observation' 
#         obs['start'] = ts.isoformat()
#         obs['end'] = (ts+timedelta(seconds=59)).isoformat()
#         # obs['device'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#string', '@value': 'Fitbit Connector' } ] # put the device in the js code to transfer less data
#         for key in data.keys():
#             obs[key] = '{0}'.format(data[key])
#         return obs

# APP = FitbitService
